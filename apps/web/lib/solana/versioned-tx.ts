import type { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionMessage, VersionedTransaction } from "@solana/web3.js";

/** Solana wire limit for serialized transactions (legacy and v0). */
export const SOLANA_MAX_RAW_TX_BYTES = 1232;

export function buildUnsignedVersionedTransaction(params: {
  feePayer: PublicKey;
  blockhash: string;
  instructions: TransactionInstruction[];
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: params.feePayer,
    recentBlockhash: params.blockhash,
    instructions: params.instructions,
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/** Wire-format bytes for a v0 tx before all required signatures exist (e.g. fee payer signs first in the wallet). */
export function serializeVersionedTransactionUnsigned(tx: VersionedTransaction): Uint8Array {
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}

export function buildVersionedTransaction(params: {
  feePayer: PublicKey;
  blockhash: string;
  instructions: TransactionInstruction[];
  additionalSigners?: Keypair[];
}): VersionedTransaction {
  const tx = buildUnsignedVersionedTransaction(params);
  const signers = params.additionalSigners?.filter(Boolean) ?? [];
  if (signers.length > 0) {
    tx.sign(signers);
  }
  return tx;
}

export function assertTxWithinSizeLimit(tx: VersionedTransaction): void {
  const len = tx.serialize().length;
  if (len > SOLANA_MAX_RAW_TX_BYTES) {
    throw new Error(
      `Transaction too large: ${len} > ${SOLANA_MAX_RAW_TX_BYTES} bytes (try create-only or a smaller initial buy).`,
    );
  }
}
