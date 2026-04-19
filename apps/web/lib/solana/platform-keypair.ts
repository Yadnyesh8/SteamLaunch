import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

function decodeSecretKey(raw: string): Uint8Array {
  const t = raw.trim();
  if (t.startsWith("[")) {
    const arr = JSON.parse(t) as number[];
    if (!Array.isArray(arr) || arr.length !== 64) {
      throw new Error("JSON secret must be a 64-byte array");
    }
    return Uint8Array.from(arr);
  }
  const decoded = bs58.decode(t);
  if (decoded.length !== 64) {
    throw new Error("Base58 secret key must decode to 64 bytes");
  }
  return decoded;
}

/**
 * Platform treasury keypair. Must match `STEAM_VERIFY_PLATFORM_SOLANA_PUBKEY`.
 * Used for server-signed flows (e.g. fee-sharing); create-token uses this pubkey as Pump `creator` while the
 * user wallet is Pump `user` (tokens + rent from the launcher).
 */
export function loadPlatformLaunchKeypair(): Keypair {
  const secret = process.env.STEAM_VERIFY_PLATFORM_SOLANA_SECRET_KEY?.trim();
  const expectPk = process.env.STEAM_VERIFY_PLATFORM_SOLANA_PUBKEY?.trim();
  if (!secret) {
    throw new Error(
      "STEAM_VERIFY_PLATFORM_SOLANA_SECRET_KEY is required (server-only; must match pubkey — used for fee-sharing and launch route validation).",
    );
  }
  if (!expectPk) {
    throw new Error("STEAM_VERIFY_PLATFORM_SOLANA_PUBKEY is required alongside the secret key.");
  }
  let kp: Keypair;
  try {
    kp = Keypair.fromSecretKey(decodeSecretKey(secret));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid secret key";
    throw new Error(`STEAM_VERIFY_PLATFORM_SOLANA_SECRET_KEY: ${msg}`);
  }
  if (kp.publicKey.toBase58() !== expectPk) {
    throw new Error(
      "STEAM_VERIFY_PLATFORM_SOLANA_SECRET_KEY public key does not match STEAM_VERIFY_PLATFORM_SOLANA_PUBKEY",
    );
  }
  return kp;
}
