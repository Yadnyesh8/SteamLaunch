const DEXSCREENER_TOKENS_URL = "https://api.dexscreener.com/latest/dex/tokens";
const CHUNK = 30;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type DexPair = {
  chainId?: string;
  baseToken?: { address?: string };
  marketCap?: number;
  fdv?: number;
};

/**
 * Best-effort USD market cap per mint (max over Solana pairs). Keys are lowercased mint addresses.
 */
export async function fetchSolanaMarketCapsUsd(mints: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const unique = [...new Set(mints.map((m) => m.trim()).filter(Boolean))];
  if (unique.length === 0) return map;

  for (const group of chunk(unique, CHUNK)) {
    let res: Response;
    try {
      res = await fetch(`${DEXSCREENER_TOKENS_URL}/${group.join(",")}`, {
        next: { revalidate: 60 },
      });
    } catch {
      continue;
    }
    if (!res.ok) continue;

    let data: { pairs?: DexPair[] };
    try {
      data = (await res.json()) as { pairs?: DexPair[] };
    } catch {
      continue;
    }

    for (const pair of data.pairs ?? []) {
      if (pair.chainId !== "solana") continue;
      const addr = pair.baseToken?.address;
      if (!addr) continue;
      const mc = typeof pair.marketCap === "number" ? pair.marketCap : pair.fdv;
      if (typeof mc !== "number" || !Number.isFinite(mc)) continue;
      const key = addr.toLowerCase();
      const prev = map.get(key) ?? 0;
      if (mc > prev) map.set(key, mc);
    }
  }

  return map;
}
