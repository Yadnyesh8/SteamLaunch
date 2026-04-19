import { prisma } from "@steam-verify/db";
import { fetchSolanaMarketCapsUsd } from "@/lib/launches/dexscreener-market-cap";
import { launchDisplayFromGame } from "@/lib/launches/parse-game-pump";
import type { ListedLaunch } from "@/lib/launches/types";

/**
 * All confirmed launches with a mint, joined to Steam game metadata, plus DexScreener market cap.
 */
export async function getListedLaunches(): Promise<ListedLaunch[]> {
  const rows = await prisma.tokenLaunch.findMany({
    where: {
      status: "CONFIRMED",
      mintAddress: { not: null },
    },
    include: {
      game: {
        select: { steamAppId: true, name: true, metadataJson: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const mints = rows.map((r) => r.mintAddress).filter((m): m is string => Boolean(m));
  const caps = await fetchSolanaMarketCapsUsd(mints);

  return rows.map((row) => {
    const mint = row.mintAddress!;
    const { steamAppId, name, metadataJson } = row.game;
    const display = launchDisplayFromGame(steamAppId, name, metadataJson);
    const cap = caps.get(mint.toLowerCase()) ?? null;
    return {
      steamAppId,
      mintAddress: mint,
      name: display.name,
      symbol: display.symbol,
      image: display.image,
      launchedAt: row.createdAt.toISOString(),
      marketCapUsd: cap,
    };
  });
}
