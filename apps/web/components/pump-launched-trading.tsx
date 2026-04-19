"use client";

import { useId, useState } from "react";

/**
 * Price chart + pump.fun links when a token is registered (pump.fun disallows iframes, so chart is DexScreener).
 * Buy/Sell rows include amount inputs for the SOL ↔ token pair; trading still completes on pump.fun.
 */
export function PumpLaunchedTrading({
  mintAddress,
  tokenSymbol,
}: {
  mintAddress: string;
  tokenSymbol: string;
}) {
  const buySolId = useId();
  const sellTokenId = useId();
  const [buySol, setBuySol] = useState("");
  const [sellToken, setSellToken] = useState("");

  const mintEnc = encodeURIComponent(mintAddress);
  const pumpCoin = `https://pump.fun/coin/${mintEnc}`;
  const chartSrc = `https://dexscreener.com/solana/${mintEnc}?embed=1&theme=dark&trades=0&info=0`;

  const buyTitle =
    buySol.trim() !== ""
      ? `Open pump.fun — plan to spend about ${buySol.trim()} SOL (enter on site)`
      : "Open pump.fun to buy with SOL";
  const sellTitle =
    sellToken.trim() !== ""
      ? `Open pump.fun — plan to sell about ${sellToken.trim()} ${tokenSymbol} (enter on site)`
      : "Open pump.fun — use the Sell tab on the token page";

  return (
    <section style={{ marginTop: "0.5rem" }}>
      <hr className="steam-divider" />
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "0.5rem 1rem",
          marginBottom: "0.75rem",
        }}
      >
        <h2 className="steam-h2">Price chart</h2>
        <a
          href={pumpCoin}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "0.9rem" }}
        >
          Open on pump.fun →
        </a>
      </div>
      <div className="steam-chart-wrap">
        <iframe
          title="Token price chart (DexScreener)"
          src={chartSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <p className="steam-muted steam-trade-pair-hint" style={{ margin: "1rem 0 0.35rem", fontSize: "0.82rem" }}>
        Pair <strong>SOL</strong> / <strong>{tokenSymbol}</strong> — set amounts here as a guide, then confirm on
        pump.fun.
      </p>
      <div className="steam-trade-rows">
        <div className="steam-trade-row">
          <label className="steam-trade-label" htmlFor={buySolId}>
            SOL
          </label>
          <input
            id={buySolId}
            type="text"
            inputMode="decimal"
            className="steam-input steam-trade-amount"
            value={buySol}
            onChange={(e) => setBuySol(e.target.value)}
            placeholder="0.0"
            autoComplete="off"
          />
          <a
            href={pumpCoin}
            target="_blank"
            rel="noopener noreferrer"
            className="steam-btn steam-btn-buy"
            title={buyTitle}
          >
            Buy
          </a>
        </div>
        <div className="steam-trade-row">
          <label className="steam-trade-label steam-trade-label--symbol" htmlFor={sellTokenId} title={tokenSymbol}>
            {tokenSymbol}
          </label>
          <input
            id={sellTokenId}
            type="text"
            inputMode="decimal"
            className="steam-input steam-trade-amount"
            value={sellToken}
            onChange={(e) => setSellToken(e.target.value)}
            placeholder="0"
            autoComplete="off"
          />
          <a
            href={pumpCoin}
            target="_blank"
            rel="noopener noreferrer"
            className="steam-btn steam-btn-sell"
            title={sellTitle}
          >
            Sell
          </a>
        </div>
      </div>
    </section>
  );
}
