import Link from "next/link";
import { GamePageExternalLinks } from "@/components/game-page-external-links";
import { GameLaunchPanel } from "@/components/game-launch-panel";
import { PumpLaunchedTrading } from "@/components/pump-launched-trading";
import { getGamePageUrl } from "@/lib/site-url";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ appId: string }> };

/** Same-origin fetch using the incoming request host (dev + deploy). */
async function loadApp(appId: number) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) {
    throw new Error("Missing Host header");
  }
  const url = `${proto}://${host}/api/steam/app/${appId}?refresh=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{
    steamAppId: number;
    pump: { name: string; symbol: string; description: string; image: string };
    metadata: Record<string, unknown>;
    launch: {
      launched: boolean;
      mintAddress: string | null;
      status: string | null;
      claimedAt: string | null;
    };
  }>;
}

export default async function GamePage({ params }: PageProps) {
  const { appId: raw } = await params;
  const appId = Number.parseInt(raw, 10);
  if (!Number.isInteger(appId) || appId <= 0) notFound();

  let data;
  try {
    data = await loadApp(appId);
  } catch (e) {
    return (
      <main className="steam-main steam-narrow">
        <p className="steam-back">
          <Link href="/">← Store</Link>
        </p>
        <p className="steam-error">{e instanceof Error ? e.message : "Failed to load game"}</p>
      </main>
    );
  }

  if (!data) notFound();

  const { pump, launch } = data;
  const mintForTrading = launch.launched ? launch.mintAddress : null;

  const h = await headers();
  const pageHost = h.get("x-forwarded-host") ?? h.get("host");
  const pageProto = h.get("x-forwarded-proto") ?? "http";
  const sharePageUrl = pageHost
    ? `${pageProto}://${pageHost}/games/${appId}`
    : getGamePageUrl(appId);

  return (
    <main className={`steam-main${mintForTrading ? " steam-with-chart" : " steam-narrow"}`}>
      <p className="steam-back">
        <Link href="/">← Store</Link>
      </p>

      <div className="steam-panel steam-panel--hero">
        <div className="steam-game-hero-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pump.image}
            alt=""
            width={184}
            height={276}
            className="steam-capsule steam-library-capsule steam-game-hero-capsule"
          />
          <h1 className="steam-h1 steam-game-hero-title" style={{ fontSize: "1.35rem" }}>
            {pump.name}
          </h1>
          <p className="steam-muted steam-game-hero-meta">
            Symbol <code>{pump.symbol}</code> · App {data.steamAppId}
          </p>
          <GamePageExternalLinks
            steamAppId={data.steamAppId}
            gameName={pump.name}
            sharePageUrl={sharePageUrl}
            pumpFunMintAddress={
              launch.launched && launch.mintAddress?.trim() ? launch.mintAddress.trim() : null
            }
          />
          <p className="steam-game-hero-status">
            {launch.launched ? (
              <>
                <span className="steam-tag steam-tag--green">Launched</span>
                {launch.mintAddress ? (
                  <>
                    {" "}
                    <span className="steam-muted" style={{ fontSize: "0.82rem" }}>
                      Mint{" "}
                      <code style={{ wordBreak: "break-all", fontSize: "0.78rem" }}>
                        {launch.mintAddress}
                      </code>
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <span className="steam-tag">Not launched</span>
            )}
            {launch.claimedAt ? (
              <span
                className="steam-muted steam-game-hero-claim"
                style={{ display: "block", marginTop: "0.45rem", fontSize: "0.85rem" }}
              >
                Claim recorded: {launch.claimedAt}
              </span>
            ) : null}
          </p>
          <p className="steam-description steam-game-hero-description">{pump.description}</p>
        </div>
      </div>

      {mintForTrading ? (
        <PumpLaunchedTrading mintAddress={mintForTrading} tokenSymbol={pump.symbol} />
      ) : null}

      <GameLaunchPanel
        steamAppId={data.steamAppId}
        launched={launch.launched}
        existingMint={launch.mintAddress}
      />

      <p className="steam-muted" style={{ marginTop: "1.25rem", fontSize: "0.85rem" }}>
        <a href={`/api/steam/app/${appId}`} target="_blank" rel="noreferrer">
          Raw JSON
        </a>
      </p>
    </main>
  );
}
