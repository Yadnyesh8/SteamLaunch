import Link from "next/link";
import type { ListedLaunch } from "@/lib/launches/types";

function formatUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function RecentLaunches({ launches }: { launches: ListedLaunch[] }) {
  if (launches.length === 0) return null;

  return (
    <section className="steam-recent-launches" style={{ marginBottom: "2rem" }}>
      <h2 className="steam-h2" style={{ marginBottom: "0.65rem" }}>
        Recent launches
      </h2>
      <p className="steam-muted" style={{ margin: "0 0 0.85rem" }}>
        Latest tokens registered on Steam Fund.
      </p>
      <ul className="steam-recent-launches__list">
        {launches.map((L) => (
          <li key={L.steamAppId}>
            <Link href={`/games/${L.steamAppId}`} className="steam-recent-launches__card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={L.image} alt="" width={72} height={108} className="steam-recent-launches__img" />
              <div className="steam-recent-launches__meta">
                <span className="steam-recent-launches__name">{L.name}</span>
                <span className="steam-recent-launches__sub">
                  <code>{L.symbol}</code>
                  <span className="steam-muted"> · mcap {formatUsd(L.marketCapUsd)}</span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
