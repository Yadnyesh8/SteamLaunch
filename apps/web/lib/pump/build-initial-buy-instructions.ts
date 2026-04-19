import {
  getBuyTokenAmountFromSolAmount,
  OnlinePumpSdk,
  PUMP_SDK,
  bondingCurvePda,
} from "@nirholas/pump-sdk";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { Connection } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import type { TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

/** Pump bonding-curve tokens use 6 decimals (@nirholas/pump-sdk analytics). */
export const PUMP_TOKEN_DECIMALS = 6;

/**
 * Bonding-curve buy with `pumpUser` = platform (Pump UI shows them as creator/dev), then SPL transfer of the
 * bought balance to the deployer’s Token-2022 ATA (platform signs the transfer).
 */
export async function buildInitialBuyInstructions(params: {
  connection: Connection;
  mint: PublicKey;
  /** Pump `user` for buy — must be the platform treasury keypair. */
  pumpUser: PublicKey;
  /** Wallet that launched via our UI; receives the bought tokens. */
  deployer: PublicKey;
  initialBuyLamports: number;
}): Promise<TransactionInstruction[]> {
  const { connection, mint, pumpUser, deployer, initialBuyLamports } = params;
  if (!Number.isInteger(initialBuyLamports) || initialBuyLamports <= 0) {
    throw new Error("initialBuyLamports must be a positive integer");
  }

  const online = new OnlinePumpSdk(connection);
  const [global, feeConfig, bondingCurve, bondingCurveAccountInfo] = await Promise.all([
    online.fetchGlobal(),
    online.fetchFeeConfig(),
    online.fetchBondingCurve(mint),
    connection.getAccountInfo(bondingCurvePda(mint)),
  ]);

  if (!bondingCurveAccountInfo) {
    throw new Error("Bonding curve not found — confirm the create transaction landed first.");
  }
  if (bondingCurve.complete) {
    throw new Error("Bonding curve is complete; cannot buy on-curve.");
  }

  const solAmount = new BN(initialBuyLamports);
  const amount = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount: solAmount,
  });

  const platformAta = getAssociatedTokenAddressSync(mint, pumpUser, true, TOKEN_2022_PROGRAM_ID);
  const associatedUserAccountInfo = await connection.getAccountInfo(platformAta);

  const buyIxs = await PUMP_SDK.buyInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    associatedUserAccountInfo,
    mint,
    user: pumpUser,
    amount,
    solAmount,
    slippage: 1,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  });

  const deployerAta = getAssociatedTokenAddressSync(mint, deployer, true, TOKEN_2022_PROGRAM_ID);

  /** Platform pays rent so the whole tx can use `pumpUser` as fee payer (no deployer signature). */
  const forwardIxs: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(
      pumpUser,
      deployerAta,
      deployer,
      mint,
      TOKEN_2022_PROGRAM_ID,
    ),
    createTransferCheckedInstruction(
      platformAta,
      mint,
      deployerAta,
      pumpUser,
      BigInt(amount.toString()),
      PUMP_TOKEN_DECIMALS,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  ];

  return [...buyIxs, ...forwardIxs];
}
