import { PUMP_SDK } from "@nirholas/pump-sdk";
import { PublicKey } from "@solana/web3.js";

/**
 * Builds the Pump v2 create instruction per SDK README (replaces deprecated createInstruction).
 * @see https://github.com/nirholas/pump-fun-sdk#create-a-token
 */
/** `creator` and `user` are typically the platform wallet (Pump UI); deployer prefunds SOL separately. */
export async function buildCreateV2TokenInstruction(params: {
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  creator: PublicKey;
  user: PublicKey;
  mayhemMode: boolean;
  cashback?: boolean;
}) {
  return PUMP_SDK.createV2Instruction({
    mint: params.mint,
    name: params.name,
    symbol: params.symbol,
    uri: params.uri,
    creator: params.creator,
    user: params.user,
    mayhemMode: params.mayhemMode,
    cashback: params.cashback,
  });
}
