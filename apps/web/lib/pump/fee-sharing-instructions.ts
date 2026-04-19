import {
  PUMP_SDK,
  OnlinePumpSdk,
  canonicalPumpPoolPda,
  feeSharingConfigPda,
} from "@nirholas/pump-sdk";
import type { Connection, PublicKey } from "@solana/web3.js";
import type { TransactionInstruction } from "@solana/web3.js";

type FeeShareholder = { address: PublicKey; shareBps: number };

function sortedShareholders(list: FeeShareholder[]): FeeShareholder[] {
  return [...list].sort((a, b) =>
    a.address.toBase58().localeCompare(b.address.toBase58()),
  );
}

function shareholdersEqual(a: FeeShareholder[], b: FeeShareholder[]): boolean {
  if (a.length !== b.length) return false;
  const sa = sortedShareholders(a);
  const sb = sortedShareholders(b);
  return sa.every(
    (x, i) => x.shareBps === sb[i].shareBps && x.address.equals(sb[i].address),
  );
}

/**
 * Instructions to split Pump creator fees between a Steam developer wallet and the platform.
 * The mint must have been launched with the platform wallet as on-chain `creator` (bonding curve).
 *
 * @see https://github.com/nirholas/pump-fun-sdk/blob/main/docs/fee-sharing.md
 */
export async function buildSteamDeveloperFeeSharingInstructions(
  connection: Connection,
  params: {
    mint: PublicKey;
    /** Wallet that receives the developer portion of creator fees (need not sign here). */
    developer: PublicKey;
    /** Platform hot wallet — must match bondingCurve.creator; signs as payer / authority. */
    platform: PublicKey;
    platformShareBps: number;
  },
): Promise<{
  instructions: TransactionInstruction[];
  graduated: boolean;
  alreadyConfigured: boolean;
}> {
  const { mint, developer, platform, platformShareBps } = params;

  if (developer.equals(platform)) {
    throw new Error("Developer fee wallet must differ from the platform wallet");
  }

  if (!Number.isInteger(platformShareBps) || platformShareBps < 1 || platformShareBps > 9999) {
    throw new Error("platformShareBps must be an integer from 1 to 9999 (exclusive remainder to creator)");
  }

  const creatorShareBps = 10000 - platformShareBps;
  const newShareholders: FeeShareholder[] = [
    { address: developer, shareBps: creatorShareBps },
    { address: platform, shareBps: platformShareBps },
  ];

  const online = new OnlinePumpSdk(connection);
  const bondingCurve = await online.fetchBondingCurve(mint);

  if (!bondingCurve.creator.equals(platform)) {
    throw new Error(
      "This mint was not created from the platform launch wallet (bonding curve creator mismatch)",
    );
  }

  const graduated = bondingCurve.complete;
  let pool: PublicKey | null = null;

  if (graduated) {
    pool = canonicalPumpPoolPda(mint);
    const poolState = await online.fetchPool(mint);
    if (!poolState.coinCreator.equals(platform)) {
      throw new Error("AMM pool coin creator does not match the platform wallet");
    }
  }

  const configPda = feeSharingConfigPda(mint);
  const configAccount = await connection.getAccountInfo(configPda);

  const instructions: TransactionInstruction[] = [];
  let currentShareholders: PublicKey[] = [];

  if (!configAccount) {
    instructions.push(
      await PUMP_SDK.createFeeSharingConfig({ creator: platform, mint, pool }),
    );
    currentShareholders = [];
  } else {
    const decoded = PUMP_SDK.decodeSharingConfig(configAccount);
    if (decoded.shareholders.length > 0) {
      if (shareholdersEqual(decoded.shareholders, newShareholders)) {
        return {
          instructions: [],
          graduated,
          alreadyConfigured: true,
        };
      }
      currentShareholders = decoded.shareholders.map((s) => s.address);
    }
  }

  instructions.push(
    await PUMP_SDK.updateFeeShares({
      authority: platform,
      mint,
      currentShareholders,
      newShareholders,
    }),
  );

  return { instructions, graduated, alreadyConfigured: false };
}
