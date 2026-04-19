import type { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { randomUUID } from "crypto";

/**
 * In-memory pending launch (fee payer signs first, then server co-signs mint + platform).
 * Fine for a single Node dev server; use Redis/DB if you scale API horizontally.
 */
export type PendingLaunchSession = {
  appId: number;
  feePayer: PublicKey;
  mintKp: Keypair;
  setupInstructions: TransactionInstruction[];
  createdAt: number;
};

const TTL_MS = 10 * 60 * 1000;
const sessions = new Map<string, PendingLaunchSession>();

function isExpired(s: PendingLaunchSession): boolean {
  return Date.now() - s.createdAt > TTL_MS;
}

export function putLaunchSession(data: Omit<PendingLaunchSession, "createdAt">): string {
  const id = randomUUID();
  sessions.set(id, { ...data, createdAt: Date.now() });
  return id;
}

export function getLaunchSession(id: string): PendingLaunchSession | undefined {
  const s = sessions.get(id);
  if (!s) return undefined;
  if (isExpired(s)) {
    sessions.delete(id);
    return undefined;
  }
  return s;
}

export function deleteLaunchSession(id: string): void {
  sessions.delete(id);
}
