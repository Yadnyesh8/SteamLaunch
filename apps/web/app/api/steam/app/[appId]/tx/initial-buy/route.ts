import { Keypair, PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { buildInitialBuyInstructions } from "@/lib/pump/build-initial-buy-instructions";
import { assertTxWithinSizeLimit, buildVersionedTransaction } from "@/lib/solana/versioned-tx";
import { getSolanaConnection } from "@/lib/solana/connection";
import { loadPlatformLaunchKeypair } from "@/lib/solana/platform-keypair";

export const runtime = "nodejs";

/** Keep in sync with create-token route. */
const MAX_INITIAL_BUY_LAMPORTS = 150_000_000_000;

type Body = {
  /** Deployer wallet (must match create tx1); receives forwarded tokens. Not a signer on this tx. */
  feePayerPublicKey?: string;
  mintPublicKey?: string;
  initialBuyLamports?: number;
};

/**
 * Bonding-curve buy + forward tokens to deployer. **Fee payer and sole signer: platform** (`STEAM_VERIFY_PLATFORM_SOLANA_*`).
 * Submitted from the server so the user does not sign this transaction.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ appId: string }> },
) {
  const { appId: raw } = await ctx.params;
  const appId = Number.parseInt(raw, 10);
  if (!Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { feePayerPublicKey, mintPublicKey } = body;
  if (!feePayerPublicKey?.trim() || !mintPublicKey?.trim()) {
    return NextResponse.json(
      { error: "feePayerPublicKey (deployer) and mintPublicKey are required" },
      { status: 400 },
    );
  }

  let initialBuyLamports = 0;
  if (body.initialBuyLamports !== undefined && body.initialBuyLamports !== null) {
    if (!Number.isInteger(body.initialBuyLamports) || body.initialBuyLamports <= 0) {
      return NextResponse.json(
        { error: "initialBuyLamports must be a positive integer (lamports)" },
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

  let deployer: PublicKey;
  let mint: PublicKey;
  try {
    deployer = new PublicKey(feePayerPublicKey.trim());
    mint = new PublicKey(mintPublicKey.trim());
  } catch {
    return NextResponse.json({ error: "Invalid public key" }, { status: 400 });
  }

  let platformKp: Keypair;
  try {
    platformKp = loadPlatformLaunchKeypair();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Platform wallet not configured";
    return NextResponse.json({ error: message }, { status: 503 });
  }
  const platformPk = platformKp.publicKey;
  if (deployer.equals(platformPk)) {
    return NextResponse.json(
      { error: "feePayerPublicKey must be the deployer wallet, not the platform launch wallet." },
      { status: 400 },
    );
  }

  const connection = getSolanaConnection();

  try {
    const buyIxs = await buildInitialBuyInstructions({
      connection,
      mint,
      pumpUser: platformPk,
      deployer,
      initialBuyLamports,
    });

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const vtx = buildVersionedTransaction({
      feePayer: platformPk,
      blockhash,
      instructions: buyIxs,
      additionalSigners: [platformKp],
    });
    assertTxWithinSizeLimit(vtx);

    const sim = await connection.simulateTransaction(vtx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });
    if (sim.value.err) {
      const logs = sim.value.logs?.slice(-25) ?? [];
      const logText = logs.length ? `\n${logs.join("\n")}` : "";
      return NextResponse.json(
        {
          error: `Initial buy failed simulation: ${JSON.stringify(sim.value.err)}${logText}`,
        },
        { status: 400 },
      );
    }

    const signature = await connection.sendRawTransaction(vtx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    return NextResponse.json({
      steamAppId: appId,
      initialBuySignature: signature,
      recentBlockhashMeta: { blockhash, lastValidBlockHeight },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to execute initial-buy transaction";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
