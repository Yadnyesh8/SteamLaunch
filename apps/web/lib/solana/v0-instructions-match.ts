import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { ComputeBudgetProgram, TransactionMessage, type VersionedTransaction } from "@solana/web3.js";

/** Wallets often inject priority-fee / CU limit ixs; they are not part of our server-built payload. */
function dropComputeBudgetInstructions(ixs: TransactionInstruction[]): TransactionInstruction[] {
  return ixs.filter((ix) => !ix.programId.equals(ComputeBudgetProgram.programId));
}

function pkShort(k: PublicKey): string {
  const s = k.toBase58();
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function ixLine(label: string, ix: TransactionInstruction, index: number): string {
  const data = Buffer.from(ix.data);
  const dataPreview = data.subarray(0, Math.min(24, data.length)).toString("hex");
  const keys = ix.keys
    .map(
      (k, j) =>
        `${j}:${pkShort(k.pubkey)} s=${k.isSigner ? 1 : 0} w=${k.isWritable ? 1 : 0}`,
    )
    .join(" | ");
  return `  ${label}[${index}] prog=${pkShort(ix.programId)} dataLen=${ix.data.length} dataHex0=${dataPreview}${data.length > 24 ? "…" : ""} keys=${ix.keys.length} ${keys}`;
}

export type V0InstructionCompareResult =
  | { ok: true }
  | { ok: false; report: string };

/**
 * Compare decompiled v0 instructions (minus compute-budget ixs) to the server-built list.
 * On failure, `report` is safe to log or return in dev-only API fields.
 *
 * `isSigner`: `TransactionMessage.decompile` often marks an account as signer in **every** ix where it appears
 * if it signs **any** ix in the tx (e.g. platform is Pump `user` but also appears as `to` on SystemProgram.transfer).
 * We only fail when the server expects a signer and the decompiled ix shows non-signer.
 *
 * `isWritable`: same idea — decompile may show writable where our built ix had readonly if that pubkey is writable
 * in another ix. Fail only when we expect writable and decompile shows readonly.
 */
export function compareV0InstructionsToExpected(
  vtx: VersionedTransaction,
  expected: TransactionInstruction[],
): V0InstructionCompareResult {
  const lines: string[] = [];
  lines.push("[v0-instructions-compare]");

  let decompiled: ReturnType<typeof TransactionMessage.decompile>;
  try {
    decompiled = TransactionMessage.decompile(vtx.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    lines.push(`TransactionMessage.decompile threw: ${msg}`);
    return { ok: false, report: lines.join("\n") };
  }

  const raw = decompiled.instructions;
  const rawCbCount = raw.filter((ix) => ix.programId.equals(ComputeBudgetProgram.programId)).length;
  const got = dropComputeBudgetInstructions(raw);

  lines.push(`recentBlockhash: ${vtx.message.recentBlockhash}`);
  lines.push(
    `message.addressTableLookups: ${vtx.message.addressTableLookups?.length ?? 0} (non-zero means ALTs; decompile may need accounts)`,
  );
  lines.push(`rawInstructionCount: ${raw.length} (computeBudgetIxsInRaw: ${rawCbCount})`);
  lines.push(`afterDropComputeBudgetCount: ${got.length}`);
  lines.push(`expectedCount: ${expected.length}`);

  lines.push("expected programs (order):");
  expected.forEach((ix, i) => lines.push(`  [${i}] ${pkShort(ix.programId)}`));
  lines.push("got programs (order, CB stripped):");
  got.forEach((ix, i) => lines.push(`  [${i}] ${pkShort(ix.programId)}`));

  if (got.length !== expected.length) {
    lines.push(
      `FAIL: instruction count mismatch (got ${got.length} vs expected ${expected.length}) after stripping ComputeBudgetProgram.`,
    );
    return { ok: false, report: lines.join("\n") };
  }

  for (let i = 0; i < expected.length; i++) {
    const a = expected[i];
    const b = got[i];
    if (!a.programId.equals(b.programId)) {
      lines.push(`FAIL at index ${i}: programId`);
      lines.push(ixLine("expected", a, i));
      lines.push(ixLine("got", b, i));
      return { ok: false, report: lines.join("\n") };
    }
    const da = Buffer.from(a.data);
    const db = Buffer.from(b.data);
    if (da.compare(db) !== 0) {
      lines.push(`FAIL at index ${i}: instruction data`);
      lines.push(ixLine("expected", a, i));
      lines.push(ixLine("got", b, i));
      lines.push(`  expectedDataHex=${da.toString("hex")}`);
      lines.push(`  gotDataHex=${db.toString("hex")}`);
      return { ok: false, report: lines.join("\n") };
    }
    if (a.keys.length !== b.keys.length) {
      lines.push(`FAIL at index ${i}: account key count ${a.keys.length} vs ${b.keys.length}`);
      lines.push(ixLine("expected", a, i));
      lines.push(ixLine("got", b, i));
      return { ok: false, report: lines.join("\n") };
    }
    for (let j = 0; j < a.keys.length; j++) {
      if (!a.keys[j].pubkey.equals(b.keys[j].pubkey)) {
        lines.push(`FAIL at index ${i} account ${j}: pubkey`);
        lines.push(`  expected ${a.keys[j].pubkey.toBase58()} s=${a.keys[j].isSigner} w=${a.keys[j].isWritable}`);
        lines.push(`  got      ${b.keys[j].pubkey.toBase58()} s=${b.keys[j].isSigner} w=${b.keys[j].isWritable}`);
        return { ok: false, report: lines.join("\n") };
      }
      if (a.keys[j].isSigner && !b.keys[j].isSigner) {
        lines.push(
          `FAIL at index ${i} account ${j}: isSigner (expected signer, decompiled shows non-signer)`,
        );
        lines.push(`  pubkey=${a.keys[j].pubkey.toBase58()}`);
        return { ok: false, report: lines.join("\n") };
      }
      if (a.keys[j].isWritable && !b.keys[j].isWritable) {
        lines.push(
          `FAIL at index ${i} account ${j}: isWritable (expected writable, decompiled shows readonly)`,
        );
        lines.push(`  pubkey=${a.keys[j].pubkey.toBase58()}`);
        return { ok: false, report: lines.join("\n") };
      }
    }
  }

  lines.push("OK: all instructions match.");
  return { ok: true };
}

/**
 * True if the v0 message’s decompiled instructions match `expected` (program, data, account metas).
 * Strips Solana compute-budget instructions first (Phantom often prepends SetComputeUnitLimit / SetComputeUnitPrice).
 */
export function v0MessageInstructionsMatchExpected(
  vtx: VersionedTransaction,
  expected: TransactionInstruction[],
): boolean {
  return compareV0InstructionsToExpected(vtx, expected).ok;
}

/** When true, include `instructionMismatchReport` on 400 responses from launch finalize routes. */
export function includeLaunchInstructionDebugInResponse(): boolean {
  return process.env.LAUNCH_TX_DEBUG === "1" || process.env.NODE_ENV === "development";
}
