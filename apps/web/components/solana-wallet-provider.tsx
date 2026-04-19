"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { type ReactNode, useMemo } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Pump.fun tokens are mainnet. RPC is required for balances, blockhash, and sending txs.
 * @see https://github.com/anza-xyz/wallet-adapter/blob/master/APP.md
 */
function solanaEndpoint(): string {
  const custom = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (custom) return custom;
  return clusterApiUrl(WalletAdapterNetwork.Mainnet);
}

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => solanaEndpoint(), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
