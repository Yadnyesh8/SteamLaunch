import { PublicKey } from "@solana/web3.js";

/**
 * Solana address that receives the platform fee-share (basis points from TokenLaunch).
 * @see https://github.com/nirholas/pump-fun-sdk/blob/main/docs/fee-sharing.md
 */
export function getPlatformFeeSharePubkey(): PublicKey {
  const raw = process.env.STEAM_VERIFY_PLATFORM_SOLANA_PUBKEY;
  if (!raw?.trim()) {
    throw new Error(
      "STEAM_VERIFY_PLATFORM_SOLANA_PUBKEY is required for fee-sharing setup",
    );
  }
  try {
    return new PublicKey(raw.trim());
  } catch {
    throw new Error("STEAM_VERIFY_PLATFORM_SOLANA_PUBKEY is not a valid public key");
  }
}
