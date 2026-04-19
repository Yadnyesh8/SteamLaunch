import type { TransactionInstruction } from "@solana/web3.js";

/** JSON-safe wire format for wallet clients to rebuild `TransactionInstruction`. */
export type SerializedInstruction = {
  programId: string;
  keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string;
};

export function serializeInstruction(ix: TransactionInstruction): SerializedInstruction {
  return {
    programId: ix.programId.toBase58(),
    keys: ix.keys.map((m) => ({
      pubkey: m.pubkey.toBase58(),
      isSigner: m.isSigner,
      isWritable: m.isWritable,
    })),
    data: Buffer.from(ix.data).toString("base64"),
  };
}

export function serializeInstructions(
  ixs: TransactionInstruction[],
): SerializedInstruction[] {
  return ixs.map(serializeInstruction);
}
