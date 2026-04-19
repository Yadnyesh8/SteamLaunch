"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Buffer } from "buffer";

const LAMPORTS_PER_SOL = 1_000_000_000;

function formatApiErrorWithInstructionDebug(
  body: { error?: string; instructionMismatchReport?: string },
  fallbackMessage: string,
): string {
  const base = body.error?.trim() ? body.error : fallbackMessage;
  const report = body.instructionMismatchReport?.trim();
  if (!report) return base;
  return `${base}\n\n--- instruction debug ---\n${report}`;
}

type LaunchEconomics = {
  platformSurchargeLamports: number;
  initialBuyLamports: number;
  userLamportsMinHint: number;
};

type CreateTokenResponse = {
  serializedTransaction: string;
  recentBlockhashMeta: { blockhash: string; lastValidBlockHeight: number };
  mintAddress: string;
  economics: LaunchEconomics;
  launchSessionId: string;
  /** When true, sign/send setup tx then `POST .../tx/initial-buy` for the bonding-curve buy. */
  twoStepInitialBuy?: boolean;
  /** Resolved metadata URI (automatic `ipfs://…` or custom). Pass to launch/register. */
  metadataUri?: string;
  error?: string;
};

type FinalizeCreateTokenResponse = {
  serializedTransaction: string;
  recentBlockhashMeta: { blockhash: string; lastValidBlockHeight: number };
  mintAddress: string;
  error?: string;
  instructionMismatchReport?: string;
};

function parseInitialBuyLamports(solField: string): { lamports: number; error: string | null } {
  const t = solField.trim();
  if (t === "") return { lamports: 0, error: null };
  const sol = Number.parseFloat(t);
  if (!Number.isFinite(sol) || sol < 0) {
    return { lamports: 0, error: "Initial buy must be a non-negative number (SOL)." };
  }
  if (sol === 0) return { lamports: 0, error: null };
  const lamports = Math.round(sol * LAMPORTS_PER_SOL);
  if (lamports < 1) {
    return { lamports: 0, error: "Initial buy is too small after converting to lamports." };
  }
  return { lamports, error: null };
}

export function GameLaunchPanel({
  steamAppId,
  launched,
  existingMint,
}: {
  steamAppId: number;
  launched: boolean;
  existingMint: string | null;
}) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const router = useRouter();
  const [initialBuySol, setInitialBuySol] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onLaunch = useCallback(async () => {
    setMessage(null);
    if (!publicKey) {
      setMessage("Connect a Solana wallet first.");
      return;
    }
    if (!signTransaction) {
      setMessage("This wallet cannot sign arbitrary transactions; try Phantom or Solflare.");
      return;
    }
    const { lamports: initialBuyLamports, error: buyErr } = parseInitialBuyLamports(initialBuySol);
    if (buyErr) {
      setMessage(buyErr);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/steam/app/${steamAppId}/tx/create-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feePayerPublicKey: publicKey.toBase58(),
          initialBuyLamports,
        }),
      });

      const body = (await res.json()) as CreateTokenResponse & { error?: string };
      if (!res.ok) {
        setMessage(body.error ?? `Create-token failed (${res.status})`);
        return;
      }

      const {
        serializedTransaction,
        recentBlockhashMeta,
        mintAddress,
        economics,
        twoStepInitialBuy,
        metadataUri: resolvedMetadataUri,
        launchSessionId,
      } = body;
      if (
        !serializedTransaction ||
        !recentBlockhashMeta ||
        !mintAddress?.trim() ||
        !economics ||
        !launchSessionId?.trim()
      ) {
        setMessage("Invalid response from server (missing transaction, session, or economics).");
        return;
      }
      if (!resolvedMetadataUri?.trim()) {
        setMessage("Invalid response from server (missing metadataUri).");
        return;
      }

      const { platformSurchargeLamports, initialBuyLamports: buyLamports } = economics;

      const setupV0 = VersionedTransaction.deserialize(
        Buffer.from(serializedTransaction, "base64"),
      );
      const signedByWallet = await signTransaction(setupV0);

      const finalizeRes = await fetch(`/api/steam/app/${steamAppId}/tx/create-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          launchSessionId: launchSessionId.trim(),
          feePayerSignedTransaction: Buffer.from(
            signedByWallet.serialize({ requireAllSignatures: false, verifySignatures: false }),
          ).toString("base64"),
        }),
      });
      const finalized = (await finalizeRes.json()) as FinalizeCreateTokenResponse & { error?: string };
      if (!finalizeRes.ok) {
        setMessage(
          formatApiErrorWithInstructionDebug(
            finalized,
            `Finalize launch failed (${finalizeRes.status})`,
          ),
        );
        return;
      }
      if (!finalized.serializedTransaction?.trim() || !finalized.recentBlockhashMeta) {
        setMessage("Invalid finalize response from server.");
        return;
      }

      const setupReady = VersionedTransaction.deserialize(
        Buffer.from(finalized.serializedTransaction, "base64"),
      );
      const setupSig = await connection.sendRawTransaction(setupReady.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      await connection.confirmTransaction(
        { signature: setupSig, ...finalized.recentBlockhashMeta },
        "confirmed",
      );

      if (twoStepInitialBuy && buyLamports > 0) {
        const buyRes = await fetch(`/api/steam/app/${steamAppId}/tx/initial-buy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feePayerPublicKey: publicKey.toBase58(),
            mintPublicKey: mintAddress.trim(),
            initialBuyLamports: buyLamports,
          }),
        });
        const buyBody = (await buyRes.json()) as {
          initialBuySignature?: string;
          error?: string;
        };
        if (!buyRes.ok) {
          setMessage(
            buyBody.error ??
              `Token was created (${setupSig.slice(0, 8)}…) but the server could not complete the initial buy.`,
          );
          return;
        }
        if (!buyBody.initialBuySignature?.trim()) {
          setMessage("Invalid initial-buy response from server.");
          return;
        }
      }

      const reg = await fetch(`/api/steam/app/${steamAppId}/launch/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mintAddress: mintAddress.trim(),
          metadataUri: resolvedMetadataUri.trim(),
          launchSignature: setupSig,
        }),
      });
      const regBody = (await reg.json()) as { error?: string };
      if (!reg.ok) {
        setMessage(
          regBody.error ??
            `Token was created (sig ${setupSig.slice(0, 8)}…) but registering the mint failed.`,
        );
        return;
      }

      const buyPart =
        buyLamports > 0
          ? `${(buyLamports / LAMPORTS_PER_SOL).toFixed(6).replace(/\.?0+$/, "")} SOL initial buy + `
          : "create only + ";
      setMessage(
        `Launched. Mint ${mintAddress.trim()} — ${buyPart}` +
          `${(platformSurchargeLamports / LAMPORTS_PER_SOL).toFixed(2)} SOL platform fee (plus rent).`,
      );
      setInitialBuySol("");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Launch failed");
    } finally {
      setBusy(false);
    }
  }, [connection, initialBuySol, publicKey, router, signTransaction, steamAppId]);

  if (launched) {
    return (
      <section className="steam-panel" style={{ marginTop: "1.5rem" }}>
        <h2 className="steam-h2">Wallet</h2>
        <WalletMultiButton />
        <p className="steam-muted" style={{ margin: "0.75rem 0 0", fontSize: "0.9rem" }}>
          {existingMint ? (
            <>
              This game already has a mint:{" "}
              <code style={{ wordBreak: "break-all" }}>{existingMint}</code>
            </>
          ) : (
            "This game is already marked launched on the platform."
          )}
        </p>
      </section>
    );
  }

  return (
    <section className="steam-panel" style={{ marginTop: "1.5rem" }}>
      <h2 className="steam-h2">Launch with Solana wallet</h2>
      <p className="steam-muted" style={{ margin: "0 0 0.85rem", lineHeight: 1.55 }}>
        Token metadata (name, symbol, description, <strong style={{ color: "var(--steam-text-bright)" }}>Steam library cover</strong> as the image) is built on the server and pinned to IPFS automatically before the create transaction. On Pump,{" "}
        <strong style={{ color: "var(--steam-text-bright)" }}>creator / dev</strong> is the platform wallet (
        <code style={{ fontSize: "0.85em" }}>STEAM_VERIFY_PLATFORM_SOLANA_PUBKEY</code>) — both Pump{" "}
        <code style={{ fontSize: "0.85em" }}>creator</code> and <code style={{ fontSize: "0.85em" }}>user</code> are
        that key. Your connected wallet is only the <strong style={{ color: "var(--steam-text-bright)" }}>fee payer</strong>{" "}
        and prefunds the platform with the <strong style={{ color: "var(--steam-text-bright)" }}>platform surcharge</strong>{" "}
        plus any optional <strong style={{ color: "var(--steam-text-bright)" }}>initial buy</strong> budget (SOL) in the
        first transaction so the platform can pay mint rent and execute the curve buy.         If you set an initial buy, the <strong style={{ color: "var(--steam-text-bright)" }}>server</strong> sends a
        second transaction (signed only by the platform wallet) that buys on the curve and forwards tokens to your
        wallet — you only <strong style={{ color: "var(--steam-text-bright)" }}>sign the first transaction</strong>.
        Leave initial buy blank for create-only, then buy on Pump separately. Keep a buffer (e.g.{" "}
        <strong style={{ color: "var(--steam-text-bright)" }}>~0.08–0.12 SOL</strong>) for fees — if simulation fails,
        open <strong style={{ color: "var(--steam-text-bright)" }}>Advanced</strong> in the wallet for program logs.
      </p>
      <div style={{ marginBottom: "0.85rem" }}>
        <WalletMultiButton />
      </div>
      <label className="steam-label" htmlFor={`initial-buy-${steamAppId}`}>
        Initial buy (SOL, optional)
      </label>
      <input
        id={`initial-buy-${steamAppId}`}
        type="text"
        inputMode="decimal"
        className="steam-input"
        value={initialBuySol}
        onChange={(e) => setInitialBuySol(e.target.value)}
        placeholder="e.g. 0.1 — leave empty for create only"
        disabled={busy}
        style={{ marginBottom: "0.85rem" }}
      />
      <button
        type="button"
        className="steam-btn steam-btn-primary"
        onClick={() => void onLaunch()}
        disabled={busy || !publicKey}
      >
        {busy ? "Signing…" : "Create Pump token"}
      </button>
      {message ? (
        <p
          className={message.startsWith("Launched") ? "steam-success" : "steam-error"}
          style={{
            margin: "0.75rem 0 0",
            fontSize: "0.88rem",
            whiteSpace: "pre-wrap",
          }}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
