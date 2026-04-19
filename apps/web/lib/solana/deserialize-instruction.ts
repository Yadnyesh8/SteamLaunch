import { Buffer } from "buffer";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";

/** Mirrors `serializeInstruction` from the API (base64 data). */
export type SerializedInstruction = {
  programId: string;
  keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string;
};

export function deserializeInstruction(s: SerializedInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(s.programId),
    keys: s.keys.map((k) => ({
      pubkey: new PublicKey(k.pubkey),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: Buffer.from(s.data, "base64"),
  });
}
