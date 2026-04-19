import { PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@steam-verify/db";
import { existingLaunchMintAddress } from "@/lib/steam/launch-status";

function parseAppId(raw: string): number | null {
  const appId = Number.parseInt(raw, 10);
  if (!Number.isInteger(appId) || appId <= 0) return null;
  return appId;
}

type Body = {
  mintAddress?: string;
  metadataUri?: string;
  launchSignature?: string;
  /** Basis points for platform when claiming fee sharing (1–9999). */
  feeSharesPlatformBps?: number;
};

/**
 * After the create tx lands, record mint + optional tx signature for this Steam app.
 * Ensures a parent `SteamGame` row exists for the FK.
 */
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

  if (!body.mintAddress?.trim()) {
    return NextResponse.json({ error: "mintAddress is required" }, { status: 400 });
  }

  try {
    new PublicKey(body.mintAddress.trim());
  } catch {
    return NextResponse.json({ error: "Invalid mintAddress" }, { status: 400 });
  }

  const bps = body.feeSharesPlatformBps;
  if (bps !== undefined) {
    if (!Number.isInteger(bps) || bps < 1 || bps > 9999) {
      return NextResponse.json(
        { error: "feeSharesPlatformBps must be an integer from 1 to 9999" },
        { status: 400 },
      );
    }
  }

  const mintTrimmed = body.mintAddress.trim();
  const priorMint = await existingLaunchMintAddress(appId);
  if (priorMint) {
    if (priorMint === mintTrimmed) {
      const launch = await prisma.tokenLaunch.findUniqueOrThrow({
        where: { steamAppId: appId },
      });
      return NextResponse.json({
        steamAppId: appId,
        launch: {
          mintAddress: launch.mintAddress,
          metadataUri: launch.metadataUri,
          launchSignature: launch.launchSignature,
          status: launch.status,
          feeSharesPlatformBps: launch.feeSharesPlatformBps,
        },
        idempotent: true,
      });
    }
    return NextResponse.json(
      {
        error:
          "This Steam game already has a different mint registered (one launch per game).",
        existingMintAddress: priorMint,
      },
      { status: 409 },
    );
  }

  await prisma.steamGame.upsert({
    where: { steamAppId: appId },
    create: {
      steamAppId: appId,
      name: `Steam App ${appId}`,
      metadataJson: { placeholder: true },
    },
    update: {},
  });

  const launch = await prisma.tokenLaunch.upsert({
    where: { steamAppId: appId },
    create: {
      steamAppId: appId,
      mintAddress: mintTrimmed,
      metadataUri: body.metadataUri?.trim() ?? null,
      launchSignature: body.launchSignature?.trim() ?? null,
      status: "CONFIRMED",
      feeSharesPlatformBps: bps ?? undefined,
    },
    update: {
      mintAddress: mintTrimmed,
      metadataUri: body.metadataUri?.trim() ?? undefined,
      launchSignature: body.launchSignature?.trim() ?? undefined,
      status: "CONFIRMED",
      ...(bps !== undefined ? { feeSharesPlatformBps: bps } : {}),
    },
  });

  return NextResponse.json({
    steamAppId: appId,
    launch: {
      mintAddress: launch.mintAddress,
      metadataUri: launch.metadataUri,
      launchSignature: launch.launchSignature,
      status: launch.status,
      feeSharesPlatformBps: launch.feeSharesPlatformBps,
    },
  });
}
