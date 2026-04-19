import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { isPinataConfigured } from "@/lib/ipfs/pinata";
import { pinSteamPumpMetadataToIpfs } from "@/lib/ipfs/pin-steam-pump-metadata";
import {
  getLaunchPlatformSurchargeLamports,
  PLATFORM_LAUNCH_FUNDING_FEE_BUFFER_LAMPORTS,
  getPlatformLaunchCreateOverheadLamports,
  getPlatformLaunchMinBalanceLamports,
} from "@/lib/launch-economics";
import { buildCreateV2AndBuyInstructions } from "@/lib/pump/build-create-v2-and-buy";
import { buildCreateV2TokenInstruction } from "@/lib/pump/create-token-instructions";
import { loadPlatformLaunchKeypair } from "@/lib/solana/platform-keypair";
import { existingLaunchMintAddress } from "@/lib/steam/launch-status";
import { loadPumpFieldsForApp } from "@/lib/steam/load-pump-fields";
import { pumpNameForOnChainCreate } from "@/lib/token/steam-to-pump-metadata";
import { getSolanaConnection } from "@/lib/solana/connection";
import { deleteLaunchSession, getLaunchSession, putLaunchSession } from "@/lib/solana/pending-launch-sessions";
import {
  assertTxWithinSizeLimit,
  buildUnsignedVersionedTransaction,
  serializeVersionedTransactionUnsigned,
} from "@/lib/solana/versioned-tx";
import {
  compareV0InstructionsToExpected,
  includeLaunchInstructionDebugInResponse,
} from "@/lib/solana/v0-instructions-match";

export const runtime = "nodejs";

function parseAppId(raw: string): number | null {
  const appId = Number.parseInt(raw, 10);
  if (!Number.isInteger(appId) || appId <= 0) return null;
  return appId;
}

/** Cap optional first buy to avoid absurd payloads (150 SOL). */
const MAX_INITIAL_BUY_LAMPORTS = 150_000_000_000;

type Body = {
  /**
   * Deployer wallet: pays network fee + prefunds `STEAM_VERIFY_PLATFORM_SOLANA_PUBKEY` (surcharge + optional buy SOL).
   * Pump `user` is the platform wallet (creator/dev on Pump); bought tokens are forwarded to this wallet in tx 2.
   */
  feePayerPublicKey?: string;
  /** Optional: use your own hosted JSON instead of automatic Pinata IPFS upload. */
  metadataUri?: string;
  /** If > 0, append Pump create + first buy for this many lamports; if 0/omit, create-only. */
  initialBuyLamports?: number;
  mayhemMode?: boolean;
  cashback?: boolean;
  /** Step 2: co-sign after the wallet signs (avoids Phantom replacing blockhash and invalidating server sigs). */
  launchSessionId?: string;
  feePayerSignedTransaction?: string;
};

/**
 * Pump `create_v2`: `creator` and `user` are both the platform wallet (Pump.fun shows them as creator/dev).
 * Deployer prefunds platform (surcharge + optional buy SOL) so the platform can pay rent and execute the buy;
 * tx 2 buys on-curve then SPL-transfers tokens to the deployer.
 * Response step 1: unsigned v0 tx + `launchSessionId`. Step 2: client posts fee-payer–signed tx; server adds mint + platform sigs.
 */
async function finalizeCreateTokenLaunch(
  appId: number,
  launchSessionId: string,
  feePayerSignedTransaction: string,
): Promise<NextResponse> {
  const pending = getLaunchSession(launchSessionId);
  if (!pending || pending.appId !== appId) {
    return NextResponse.json(
      { error: "Invalid or expired launch session — start Create Pump token again." },
      { status: 400 },
    );
  }

  let platformKp: Keypair;
  try {
    platformKp = loadPlatformLaunchKeypair();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Platform wallet not configured";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  let vtx: VersionedTransaction;
  try {
    vtx = VersionedTransaction.deserialize(Buffer.from(feePayerSignedTransaction, "base64"));
  } catch {
    return NextResponse.json({ error: "Invalid feePayerSignedTransaction (bad base64 or tx bytes)." }, { status: 400 });
  }

  const decompiled = TransactionMessage.decompile(vtx.message);
  if (!decompiled.payerKey.equals(pending.feePayer)) {
    return NextResponse.json(
      { error: "Transaction fee payer does not match the launch session." },
      { status: 400 },
    );
  }

  const ixCmp = compareV0InstructionsToExpected(vtx, pending.setupInstructions);
  if (!ixCmp.ok) {
    console.warn(
      `[create-token finalize] appId=${appId} session=${launchSessionId.slice(0, 8)}… instruction mismatch:\n${ixCmp.report}`,
    );
    return NextResponse.json(
      {
        error: "Transaction does not match this launch (possible tampering).",
        ...(includeLaunchInstructionDebugInResponse()
          ? { instructionMismatchReport: ixCmp.report }
          : {}),
      },
      { status: 400 },
    );
  }

  try {
    vtx.sign([pending.mintKp, platformKp]);
    assertTxWithinSizeLimit(vtx);

    const connection = getSolanaConnection();
    const sim = await connection.simulateTransaction(vtx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });
    if (sim.value.err) {
      const logs = sim.value.logs?.slice(-25) ?? [];
      const logText = logs.length ? `\n${logs.join("\n")}` : "";
      return NextResponse.json(
        {
          error: `Launch transaction failed simulation after co-sign: ${JSON.stringify(sim.value.err)}${logText}`,
        },
        { status: 400 },
      );
    }

    const { lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    deleteLaunchSession(launchSessionId);

    return NextResponse.json({
      serializedTransaction: Buffer.from(vtx.serialize()).toString("base64"),
      recentBlockhashMeta: {
        blockhash: vtx.message.recentBlockhash,
        lastValidBlockHeight,
      },
      mintAddress: pending.mintKp.publicKey.toBase58(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to finalize launch transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ appId: string }> },
) {
  const { appId: raw } = await ctx.params;
  const appId = parseAppId(raw);
  if (appId === null) {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.launchSessionId?.trim() && body.feePayerSignedTransaction?.trim()) {
    return finalizeCreateTokenLaunch(
      appId,
      body.launchSessionId.trim(),
      body.feePayerSignedTransaction.trim(),
    );
  }

  const { feePayerPublicKey, metadataUri } = body;
  if (!feePayerPublicKey?.trim()) {
    return NextResponse.json(
      {
        error:
          "feePayerPublicKey is required (deployer wallet: fees + prefund surcharge and optional buy SOL to the platform).",
      },
      { status: 400 },
    );
  }

  let initialBuyLamports = 0;
  if (body.initialBuyLamports !== undefined && body.initialBuyLamports !== null) {
    if (!Number.isInteger(body.initialBuyLamports) || body.initialBuyLamports < 0) {
      return NextResponse.json(
        { error: "initialBuyLamports must be a non-negative integer (lamports)" },
        { status: 400 },
      );
    }
    initialBuyLamports = body.initialBuyLamports;
  }
  if (initialBuyLamports > MAX_INITIAL_BUY_LAMPORTS) {
    return NextResponse.json(
      { error: `initialBuyLamports exceeds maximum (${MAX_INITIAL_BUY_LAMPORTS} lamports)` },
      { status: 400 },
    );
  }

  let feePayer: PublicKey;
  try {
    feePayer = new PublicKey(feePayerPublicKey.trim());
  } catch {
    return NextResponse.json({ error: "Invalid feePayerPublicKey" }, { status: 400 });
  }

  let platformKp: Keypair;
  try {
    platformKp = loadPlatformLaunchKeypair();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Platform wallet not configured";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const platformPk = platformKp.publicKey;
  if (feePayer.equals(platformPk)) {
    return NextResponse.json(
      { error: "feePayerPublicKey must be a different wallet than the platform launch wallet." },
      { status: 400 },
    );
  }

  const pump = await loadPumpFieldsForApp(appId);
  if (!pump) {
    return NextResponse.json(
      { error: "Unknown Steam app or could not build Pump fields" },
      { status: 404 },
    );
  }

  const existingMint = await existingLaunchMintAddress(appId);
  if (existingMint) {
    return NextResponse.json(
      {
        error:
          "This Steam game already has a token registered on our platform (one launch per game).",
        mintAddress: existingMint,
      },
      { status: 409 },
    );
  }

  const connection = getSolanaConnection();
  const platformSurchargeLamports = getLaunchPlatformSurchargeLamports();

  const startBal = await connection.getBalance(platformPk);

  const minIdle = getPlatformLaunchMinBalanceLamports();
  if (minIdle !== null && startBal < minIdle) {
    return NextResponse.json(
      {
        error: `Platform launch wallet idle balance is too low (${startBal} lamports; minimum ${minIdle} lamports). Fund ${platformPk.toBase58()} or set PLATFORM_LAUNCH_MIN_BALANCE_LAMPORTS=0 to disable this ops check.`,
      },
      { status: 503 },
    );
  }

  const createOverhead = getPlatformLaunchCreateOverheadLamports();
  const minForCreate =
    createOverhead + PLATFORM_LAUNCH_FUNDING_FEE_BUFFER_LAMPORTS;
  const availableForCreateRent = startBal + platformSurchargeLamports + initialBuyLamports;
  if (availableForCreateRent < minForCreate) {
    return NextResponse.json(
      {
        error:
          `This launch needs at least ${minForCreate} lamports available for Pump create rent and fees ` +
          `(platform balance + surcharge in the same transaction). Currently: platform ${startBal} lamports + ` +
          `surcharge ${platformSurchargeLamports} lamports = ${availableForCreateRent} lamports. ` +
          `Fund ${platformPk.toBase58()}, raise LAUNCH_PLATFORM_SURCHARGE_LAMPORTS, or adjust PLATFORM_LAUNCH_CREATE_OVERHEAD_LAMPORTS if estimates are off.`,
      },
      { status: 503 },
    );
  }

  const customUri = metadataUri?.trim();
  let resolvedMetadataUri: string;
  let ipfs: { coverSource: string } | undefined;

  if (customUri) {
    resolvedMetadataUri = customUri;
  } else {
    if (!isPinataConfigured()) {
      return NextResponse.json(
        {
          error:
            "Set PINATA_JWT and PINATA_GATEWAY (or NEXT_PUBLIC_GATEWAY_URL) for automatic IPFS metadata via Pinata, or pass metadataUri to use your own hosted metadata. See https://docs.pinata.cloud/frameworks/next-js",
        },
        { status: 503 },
      );
    }
    try {
      const pinned = await pinSteamPumpMetadataToIpfs({ appId, pump });
      resolvedMetadataUri = pinned.metadataUri;
      ipfs = { coverSource: pinned.coverSource };
    } catch (e) {
      const message = e instanceof Error ? e.message : "IPFS metadata upload failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  /** SOL the deployer sends to the platform in setup (surcharge + buy budget for tx 2). */
  const prefundLamports = platformSurchargeLamports + initialBuyLamports;

  const mintKp = Keypair.generate();
  const mint = mintKp.publicKey;
  const mintNameOnChain = pumpNameForOnChainCreate(pump.name);

  try {
    const twoStepInitialBuy = initialBuyLamports > 0;

    let pumpIxs: TransactionInstruction[];
    if (twoStepInitialBuy) {
      const full = await buildCreateV2AndBuyInstructions({
        connection,
        mint,
        name: mintNameOnChain,
        symbol: pump.symbol,
        uri: resolvedMetadataUri,
        creator: platformPk,
        user: platformPk,
        initialBuyLamports,
        mayhemMode: Boolean(body.mayhemMode),
        cashback: body.cashback,
      });
      if (full.length !== 4) {
        throw new Error(`Expected 4 Pump instructions for create+buy, got ${full.length}`);
      }
      pumpIxs = full.slice(0, 3);
    } else {
      pumpIxs = [
        await buildCreateV2TokenInstruction({
          mint,
          name: mintNameOnChain,
          symbol: pump.symbol,
          uri: resolvedMetadataUri,
          creator: platformPk,
          user: platformPk,
          mayhemMode: Boolean(body.mayhemMode),
          cashback: body.cashback,
        }),
      ];
    }

    // Prefund platform first so it can pay Pump rent + hold buy SOL for tx 2.
    const setupInstructions: TransactionInstruction[] = [];
    if (prefundLamports > 0) {
      setupInstructions.push(
        SystemProgram.transfer({
          fromPubkey: feePayer,
          toPubkey: platformPk,
          lamports: prefundLamports,
        }),
      );
    }
    setupInstructions.push(...pumpIxs);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const vtxUnsigned = buildUnsignedVersionedTransaction({
      feePayer,
      blockhash,
      instructions: setupInstructions,
    });
    const vtxForSim = buildUnsignedVersionedTransaction({
      feePayer,
      blockhash,
      instructions: setupInstructions,
    });
    vtxForSim.sign([mintKp, platformKp]);
    assertTxWithinSizeLimit(vtxForSim);

    const sim = await connection.simulateTransaction(vtxForSim, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });
    if (sim.value.err) {
      const logs = sim.value.logs?.slice(-25) ?? [];
      const logText = logs.length ? `\n${logs.join("\n")}` : "";
      return NextResponse.json(
        {
          error: `Launch transaction failed simulation (fix balance or RPC cluster before signing). Details: ${JSON.stringify(sim.value.err)}${logText}`,
        },
        { status: 400 },
      );
    }

    const launchSessionId = putLaunchSession({
      appId,
      feePayer,
      mintKp,
      setupInstructions,
    });

    return NextResponse.json({
      steamAppId: appId,
      pump: {
        name: pump.name,
        symbol: pump.symbol,
        description: pump.description,
        steamAppId: pump.steamAppId,
      },
      mintAddress: mint.toBase58(),
      metadataUri: resolvedMetadataUri,
      ...(ipfs ? { ipfs } : {}),
      twoStepInitialBuy,
      launchSessionId,
      /** Unsigned until you sign in the wallet; server co-signs in step 2 so Phantom can refresh blockhash safely. */
      serializedTransaction: Buffer.from(serializeVersionedTransactionUnsigned(vtxUnsigned)).toString("base64"),
      recentBlockhashMeta: { blockhash, lastValidBlockHeight },
      economics: {
        platformSurchargeLamports,
        initialBuyLamports,
        /** Lamports the deployer prefunds to the platform (surcharge + optional buy) plus keep rent for tx fees. */
        userLamportsMinHint: prefundLamports,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to build launch transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
