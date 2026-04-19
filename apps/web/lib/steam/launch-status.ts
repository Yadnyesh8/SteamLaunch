import { prisma } from "@steam-verify/db";

/** Summary for UI: search → app details → allow create-token only when `launched` is false. */
export async function getSteamAppLaunchSummary(steamAppId: number): Promise<{
  launched: boolean;
  mintAddress: string | null;
  status: string | null;
  claimedAt: string | null;
}> {
  const row = await prisma.tokenLaunch.findUnique({
    where: { steamAppId },
    select: { mintAddress: true, status: true, claimedAt: true },
  });
  if (!row) {
    return {
      launched: false,
      mintAddress: null,
      status: null,
      claimedAt: null,
    };
  }
  return {
    launched: Boolean(row.mintAddress),
    mintAddress: row.mintAddress,
    status: row.status,
    claimedAt: row.claimedAt?.toISOString() ?? null,
  };
}

/** Mint already registered for this Steam app (one launch per game). */
export async function existingLaunchMintAddress(
  steamAppId: number,
): Promise<string | null> {
  const row = await prisma.tokenLaunch.findUnique({
    where: { steamAppId },
    select: { mintAddress: true },
  });
  return row?.mintAddress ?? null;
}
