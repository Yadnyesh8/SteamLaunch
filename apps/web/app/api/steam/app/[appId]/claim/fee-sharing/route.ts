import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@steam-verify/db";
import { getSteamSession } from "@/lib/auth/get-session";
import { buildSteamDeveloperFeeSharingInstructions } from "@/lib/pump/fee-sharing-instructions";
import { getPlatformFeeSharePubkey } from "@/lib/pump/platform-pubkey";
import { loadPlatformLaunchKeypair } from "@/lib/solana/platform-keypair";
import { getSolanaConnection } from "@/lib/solana/connection";

function parseAppId(raw: string): number | null {
  const appId = Number.parseInt(raw, 10);
  if (!Number.isInteger(appId) || appId <= 0) return null;
  return appId;
}

type Body = {
  /**
   * Solana wallet that should receive the developer share of Pump creator fees.
   * Launches use the platform wallet as on-chain creator; this is typically the dev’s own wallet.
   */
  developerPublicKey?: string;
  /** @deprecated Use developerPublicKey (same meaning). */
  creatorPublicKey?: string;
};

/**
 * Authenticated Steam user: instructions to enable creator fee sharing between the
 * developer’s wallet and the platform (bonding-curve creator is the platform; authority is platform).
 *
 * @see https://github.com/nirholas/pump-fun-sdk/blob/main/docs/fee-sharing.md
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ appId: string }> },
) {
  const session = await getSteamSession(req);
  if (!session) {
    return NextResponse.json({ error: "Sign in with Steam required" }, { status: 401 });
  }

  const { appId: raw } = await ctx.params;
  const appId = parseAppId(raw);
  if (appId === null) {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const devRaw = body.developerPublicKey?.trim() || body.creatorPublicKey?.trim();
  if (!devRaw) {
    return NextResponse.json(
      {
        error:
          "developerPublicKey is required (Solana wallet that should receive your share of creator fees)",
      },
      { status: 400 },
    );
  }

  let developer: PublicKey;
  try {
    developer = new PublicKey(devRaw);
  } catch {
    return NextResponse.json({ error: "Invalid developerPublicKey" }, { status: 400 });
  }

  const launch = await prisma.tokenLaunch.findUnique({
    where: { steamAppId: appId },
  });

  if (!launch?.mintAddress) {
    return NextResponse.json(
      { error: "No registered launch / mint for this Steam app" },
      { status: 404 },
    );
  }

  if (launch.claimedAt) {
    return NextResponse.json(
      { error: "This launch was already marked claimed in Steam Fund" },
      { status: 409 },
    );
  }

  let mint: PublicKey;
  try {
    mint = new PublicKey(launch.mintAddress);
  } catch {
    return NextResponse.json({ error: "Stored mintAddress is invalid" }, { status: 500 });
  }

  let platform: PublicKey;
  try {
    platform = getPlatformFeeSharePubkey();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Platform pubkey misconfigured";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (developer.equals(platform)) {
    return NextResponse.json(
      { error: "developerPublicKey must differ from the platform treasury address" },
      { status: 400 },
    );
  }

  const platformBps = launch.feeSharesPlatformBps ?? 500;
  if (!Number.isInteger(platformBps) || platformBps < 1 || platformBps > 9999) {
    return NextResponse.json(
      {
        error:
          "TokenLaunch.feeSharesPlatformBps must be set to an integer 1–9999 (creator gets the remainder)",
      },
      { status: 400 },
    );
  }

  const connection = getSolanaConnection();

  try {
    const { instructions, graduated, alreadyConfigured } =
      await buildSteamDeveloperFeeSharingInstructions(connection, {
        mint,
        developer,
        platform,
        platformShareBps: platformBps,
      });

    if (alreadyConfigured) {
      return NextResponse.json({
        steamAppId: appId,
        mint: launch.mintAddress,
        graduated,
        alreadyConfigured: true,
        message:
          "On-chain fee sharing already matches this platform split; nothing to submit.",
      });
    }

    let platformKp: Keypair;
    try {
      platformKp = loadPlatformLaunchKeypair();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Platform wallet not configured for fee-sharing submit";
      return NextResponse.json({ error: message }, { status: 503 });
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = platform;
    for (const ix of instructions) {
      tx.add(ix);
    }
    tx.sign(platformKp);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    return NextResponse.json({
      steamAppId: appId,
      mint: launch.mintAddress,
      graduated,
      platformShareBps: platformBps,
      creatorShareBps: 10000 - platformBps,
      submitted: true,
      signature,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to configure fee sharing on-chain";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
