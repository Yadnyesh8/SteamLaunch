import type { Metadata } from "next";
import { SolanaWalletProvider } from "@/components/solana-wallet-provider";
import { SteamHeader } from "@/components/steam-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Steam Fund",
  description: "Steam-linked launchpad for Pump tokens",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SolanaWalletProvider>
          <div className="steam-shell">
            <SteamHeader />
            {children}
          </div>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
