import Link from "next/link";
import { LaunchedTokensExplorer } from "@/components/launched-tokens-explorer";
import { RecentLaunches } from "@/components/recent-launches";
import { SteamGameSearch } from "@/components/steam-game-search";
import { getListedLaunches } from "@/lib/launches/get-listed-launches";

export const revalidate = 60;

export default async function HomePage() {
  const launches = await getListedLaunches();
  const recentLaunches = launches.slice(0, 3);

  return (
    <main className="steam-main">
      <h1 className="steam-h1">Welcome to Steam Fund</h1>
      <p className="steam-muted" style={{ marginTop: 0, marginBottom: "1.25rem" }}>
        Search the Steam catalog and launch Pump tokens tied to your games.
      </p>

      <section className="steam-dev-callout">
        <h2>Steam developer? Claim SOL creator fees</h2>
        <p>
          Sign in with Steam, then open each of your Steamworks titles to set up Pump fee sharing for
          your game&apos;s token.
        </p>
        <Link href="/developers" className="steam-dev-callout-cta">
          I&apos;m a developer — claim fees for my games →
        </Link>
      </section>

      <RecentLaunches launches={recentLaunches} />

      <SteamGameSearch />

      <LaunchedTokensExplorer launches={launches} />

      <section className="steam-docs">
        <p style={{ marginTop: 0 }}>Monorepo: Next.js + Prisma (Neon).</p>
        <p>
          Launch flow: search games → open app page → if <code>launch.launched</code> is false, call{" "}
          <code>POST .../tx/create-token</code> (server pins metadata to IPFS via Pinata when{" "}
          <code>PINATA_JWT</code> and a gateway host are set), sign the tx, then{" "}
          <code>POST .../launch/register</code>. Each Steam app allows at most
          one registered mint.
        </p>
        <ul>
          <li>
            <Link href="/api/auth/steam">Sign in with Steam (Partner OAuth)</Link> — or start from{" "}
            <Link href="/developers">Developers</Link>
          </li>
          <li>
            <Link href="/api/steam/search?q=portal">Steam search example (JSON)</Link>
          </li>
          <li>
            <Link href="/api/steam/app/620">Steam app → Pump fields example (Portal 2)</Link>
          </li>
          <li>
            Pump: <code>POST /api/steam/app/&lt;id&gt;/tx/create-token</code> (body:{" "}
            <code>feePayerPublicKey</code>; optional <code>metadataUri</code>) — v0 tx, mint keypair presigned;
            optional buy uses <code>POST …/tx/initial-buy</code> second —{" "}
            <a href="https://github.com/nirholas/pump-fun-sdk#create-a-token">createV2Instruction</a>
          </li>
          <li>
            After mint: <code>POST .../launch/register</code> then signed-in{" "}
            <code>POST .../claim/fee-sharing</code> (body: <code>developerPublicKey</code>; server submits
            with platform key) + <code>POST .../claim/complete</code> —{" "}
            <a href="https://github.com/nirholas/pump-fun-sdk/blob/main/docs/fee-sharing.md">
              fee sharing
            </a>
          </li>
          <li>
            <Link href="/api/health/db">DB health</Link>
          </li>
          <li>
            <Link href="/api/auth/me">Session (JSON)</Link>
          </li>
        </ul>
        <p>
          Register redirect URI with Valve exactly as{" "}
          <code>{`https://your-domain/auth/steam/callback`}</code> (see{" "}
          <a href="https://partner.steamgames.com/doc/webapi_overview/oauth">Steamworks OAuth</a>).
        </p>
      </section>
    </main>
  );
}
