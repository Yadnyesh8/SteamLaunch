"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ListedLaunch } from "@/lib/launches/types";

type SortMode =
  | "market_cap_desc"
  | "market_cap_asc"
  | "launched_desc"
  | "launched_asc"
  | "name_asc"
  | "name_desc";

function formatUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function sortLaunches(list: ListedLaunch[], mode: SortMode): ListedLaunch[] {
  const next = [...list];
  const cap = (L: ListedLaunch) => L.marketCapUsd ?? -1;
  const t = (L: ListedLaunch) => new Date(L.launchedAt).getTime();

  switch (mode) {
    case "market_cap_desc":
      return next.sort((a, b) => cap(b) - cap(a));
    case "market_cap_asc":
      return next.sort((a, b) => {
        const ca = a.marketCapUsd;
        const cb = b.marketCapUsd;
        if (ca == null && cb == null) return 0;
        if (ca == null) return 1;
        if (cb == null) return -1;
        return ca - cb;
      });
    case "launched_desc":
      return next.sort((a, b) => t(b) - t(a));
    case "launched_asc":
      return next.sort((a, b) => t(a) - t(b));
    case "name_asc":
      return next.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    case "name_desc":
      return next.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }));
    default:
      return next;
  }
}

export function LaunchedTokensExplorer({ launches }: { launches: ListedLaunch[] }) {
  const [sort, setSort] = useState<SortMode>("launched_desc");

  const visible = useMemo(() => sortLaunches([...launches], sort), [launches, sort]);

  return (
    <section className="steam-launches-explorer" style={{ marginBottom: "2rem" }}>
      <h2 className="steam-h2" style={{ marginBottom: "0.5rem" }}>
        Launched tokens
      </h2>
      <p className="steam-muted" style={{ margin: "0 0 1rem" }}>
        All registered tokens. Use search above for the full Steam catalog (with launch status). Market
        cap from DexScreener (Solana); may lag or be missing for very new mints.
      </p>

      <div className="steam-launches-explorer__toolbar steam-launches-explorer__toolbar--sort-only">
        <div style={{ flex: "0 0 14rem", maxWidth: "100%" }}>
          <label htmlFor="launches-sort" className="steam-label">
            Sort by
          </label>
          <select
            id="launches-sort"
            className="steam-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
          >
            <option value="market_cap_desc">Market cap (high → low)</option>
            <option value="market_cap_asc">Market cap (low → high)</option>
            <option value="launched_desc">Newest launch</option>
            <option value="launched_asc">Oldest launch</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
          </select>
        </div>
      </div>

      {launches.length === 0 ? (
        <p className="steam-muted" style={{ marginTop: "1rem" }}>
          No tokens have been registered yet. Search above for a Steam game to open its page and launch
          one.
        </p>
      ) : (
        <ul className="steam-launch-grid">
          {visible.map((L) => (
            <li key={L.steamAppId}>
              <Link href={`/games/${L.steamAppId}`} className="steam-launch-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={L.image} alt="" width={184} height={276} className="steam-launch-card__img" />
                <div className="steam-launch-card__body">
                  <span className="steam-launch-card__title">{L.name}</span>
                  <span className="steam-launch-card__meta">
                    <code>{L.symbol}</code>
                    <span className="steam-muted"> · App {L.steamAppId}</span>
                  </span>
                  <span className="steam-launch-card__stats">
                    <span>MCap {formatUsd(L.marketCapUsd)}</span>
                    <span className="steam-muted">{formatDate(L.launchedAt)}</span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
