import { cookies } from "next/headers";
import Link from "next/link";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { fetchPartnerAppListForWebApiKey } from "@/lib/steam/partner-app-list";
import { prisma } from "@steam-verify/db";

const signInHref = `/api/auth/steam?redirect=${encodeURIComponent("/developers")}`;

export default async function DevelopersPage() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return (
      <main className="steam-main steam-narrow">
        <p className="steam-back">
          <Link href="/">← Store</Link>
        </p>
        <h1 className="steam-h1">Claim creator fees</h1>
        <p style={{ lineHeight: 1.55, color: "var(--steam-text)" }}>
          If you ship games on Steam, sign in with the Steam account linked to your Steamworks partner
          access. We will list the Steam app IDs registered to your site&apos;s{" "}
          <strong style={{ color: "var(--steam-text-bright)" }}>Steamworks Web API publisher key</strong>
          , then you can open each game to finish Pump fee-sharing on Solana.
        </p>
        <p style={{ marginTop: "1.25rem" }}>
          <a href={signInHref} className="steam-btn steam-btn-dark">
            Sign in with Steam
          </a>
        </p>
        <p className="steam-muted" style={{ marginTop: "1rem", fontSize: "0.88rem", lineHeight: 1.5 }}>
          The app list comes from Valve&apos;s{" "}
          <a
            href="https://partner.steamgames.com/doc/webapi/isteamapps"
            target="_blank"
            rel="noopener noreferrer"
          >
            GetPartnerAppListForWebAPIKey
          </a>{" "}
          API and matches whatever apps your <code>STEAM_WEB_API_KEY</code> is authorized for—not your
          personal game library.
        </p>
      </main>
    );
  }

  const user = await prisma.steamUser.findUnique({
    where: { steamId64: session.steamId64 },
    select: { displayName: true, steamId64: true },
  });

  const publisherKey = process.env.STEAM_WEB_API_KEY?.trim();
  if (!publisherKey) {
    return (
      <main className="steam-main steam-narrow">
        <p className="steam-back">
          <Link href="/">← Store</Link>
        </p>
        <p className="steam-error">
          <code>STEAM_WEB_API_KEY</code> is not set. Add your Steamworks publisher Web API key on the
          server to load your Steamworks app list.
        </p>
      </main>
    );
  }

  let games: Awaited<ReturnType<typeof fetchPartnerAppListForWebApiKey>>;
  let loadError: string | null = null;
  try {
    games = await fetchPartnerAppListForWebApiKey(publisherKey, { typeFilter: "game" });
  } catch (e) {
    games = [];
    loadError = e instanceof Error ? e.message : "Failed to load Steamworks apps";
  }

  return (
    <main className="steam-main steam-narrow">
      <p className="steam-back">
        <Link href="/">← Store</Link>
      </p>
      <h1 className="steam-h1">Your Steamworks games</h1>
      <p className="steam-muted" style={{ marginTop: 0 }}>
        Signed in as <strong style={{ color: "var(--steam-text-bright)" }}>{user?.displayName ?? "Steam user"}</strong>{" "}
        <span style={{ fontSize: "0.85rem" }}>
          (<code>{session.steamId64}</code>)
        </span>
      </p>

      {loadError ? (
        <p className="steam-error" style={{ marginTop: "1rem" }}>
          {loadError}
        </p>
      ) : games.length === 0 ? (
        <p style={{ marginTop: "1.25rem", lineHeight: 1.55, color: "var(--steam-text)" }}>
          No apps with type <code>game</code> were returned for this Web API key. If you ship tools or
          demos, ask your operator to adjust the filter or confirm the key belongs to the right
          Steamworks partner.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "1.25rem 0 0",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {games.map((g) => (
            <li key={g.appid}>
              <Link href={`/games/${g.appid}`} className="steam-panel steam-dev-game-link">
                <span className="steam-dev-game-title">{g.app_name}</span>
                <span className="steam-list-item-meta" style={{ marginLeft: "0.5rem" }}>
                  App {g.appid}
                  {g.app_type !== "game" ? ` · ${g.app_type}` : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="steam-muted" style={{ marginTop: "1.5rem", fontSize: "0.85rem" }}>
        Wrong account? <a href={signInHref}>Sign in again</a> (you may need to sign out of Steam in your
        browser first).
      </p>
    </main>
  );
}
