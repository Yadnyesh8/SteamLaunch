export type ListedLaunch = {
  steamAppId: number;
  mintAddress: string;
  name: string;
  symbol: string;
  image: string;
  /** ISO timestamp — `TokenLaunch.createdAt` when the mint was registered. */
  launchedAt: string;
  /** USD from DexScreener (max across Solana pairs); null if unknown. */
  marketCapUsd: number | null;
};
