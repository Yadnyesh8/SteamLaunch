import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@steam-verify/db";
import { getSteamSession } from "@/lib/auth/get-session";

function parseAppId(raw: string): number | null {
  const appId = Number.parseInt(raw, 10);
  if (!Number.isInteger(appId) || appId <= 0) return null;
  return appId;
}

/**
 * Marks the Steam-side claim complete after the developer has submitted the fee-sharing tx.
 * (On-chain verification can be added later via tx signature.)
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

  const user = await prisma.steamUser.findUnique({
    where: { steamId64: session.steamId64 },
  });
  if (!user) {
    return NextResponse.json({ error: "Steam user not found" }, { status: 404 });
  }

  const launch = await prisma.tokenLaunch.findUnique({
    where: { steamAppId: appId },
  });

  if (!launch?.mintAddress) {
    return NextResponse.json({ error: "No launch for this app" }, { status: 404 });
  }

  if (launch.claimedAt) {
    return NextResponse.json(
      { error: "Already claimed", claimedAt: launch.claimedAt.toISOString() },
      { status: 409 },
    );
  }

  const updated = await prisma.tokenLaunch.update({
    where: { steamAppId: appId },
    data: {
      claimedAt: new Date(),
      claimerId: user.id,
    },
  });

  return NextResponse.json({
    steamAppId: appId,
    claimedAt: updated.claimedAt?.toISOString() ?? null,
    claimerSteamId64: session.steamId64,
  });
}
