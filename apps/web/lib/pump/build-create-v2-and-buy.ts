import {
  getBuyTokenAmountFromSolAmount,
  OnlinePumpSdk,
  PUMP_SDK,
} from "@nirholas/pump-sdk";
import type { Connection } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import type { TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

/**
 * Create mint + extend + ATA + buy ix (four instructions). For our two-step flow we slice off the buy and run it
 * in a second tx; pass the same pubkey for `creator` and `user` (platform) so Pump shows the platform as creator/dev.
 * Deployer prefunds that wallet with buy SOL in tx 1.
 */
export async function buildCreateV2AndBuyInstructions(params: {
  connection: Connection;
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  creator: PublicKey;
  user: PublicKey;
  /** Lamports spent on the first bonding-curve buy (e.g. 0.1 SOL). */
  initialBuyLamports: number;
  mayhemMode: boolean;
  cashback?: boolean;
}): Promise<TransactionInstruction[]> {
  const {
    connection,
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    initialBuyLamports,
    mayhemMode,
    cashback,
  } = params;

  if (!Number.isInteger(initialBuyLamports) || initialBuyLamports <= 0) {
    throw new Error("initialBuyLamports must be a positive integer");
  }

  const online = new OnlinePumpSdk(connection);
  const [global, feeConfig] = await Promise.all([
    online.fetchGlobal(),
    online.fetchFeeConfig(),
  ]);

  const solAmount = new BN(initialBuyLamports);
  const amount = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: null,
    bondingCurve: null,
    amount: solAmount,
  });

  return PUMP_SDK.createV2AndBuyInstructions({
    global,
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    amount,
    solAmount,
    mayhemMode,
    cashback,
  });
}
