import { Connection } from "@solana/web3.js";

export function getSolanaConnection(): Connection {
  const endpoint =
    process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  return new Connection(endpoint, { commitment: "confirmed" });
}
