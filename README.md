# 🎮 SteamLaunch

**Launch tokens. Raise funds. Build trust.**

Steam-Verify is a platform that lets game developers and creators launch their own tokens on Solana (via [pump.fun](https://pump.fun)) — but with a twist. Before anyone can create a token, they have to prove who they are through their Steam account. No anonymous rug-pulls. No fake teams. Just real people with real gaming histories, raising real funds from communities that can actually trust them.

---

## 🤔 Why does this exist?

If you've spent any time in crypto, you already know the problem: anyone can spin up a token in 30 seconds, promise the world, and disappear with the money by lunchtime.

We thought — what if launching a token required you to actually *prove* you're a real person first? Not with some sketchy KYC form that asks for your passport, but with something you've had for years: your **Steam account**.

Your Steam profile is surprisingly hard to fake. Account age, hundreds of hours in games, community reputation, VAC status — all of that tells a story. Steam-Verify reads that story and uses it to give investors a reason to believe you're not going anywhere.

---

## ✨ What it does

### For Creators / Developers
- **Sign in with Steam** — One click. No passwords to remember, no forms to fill out. We use Steam's OpenID protocol to verify your identity.
- **Get verified** — We pull your public Steam data (account age, game library, community standing) and build a trust profile. The older and more active your account, the more credible you look.
- **Launch a token** — Once verified, you can launch your own SPL token directly on Solana through pump.fun's bonding curve. Fair launch. Transparent distribution. No pre-sales, no insider deals.
- **Raise funds** — Your community buys in knowing that you're a verified, real human being. That trust translates directly into funding for your game, mod, or project.

### For Investors / Community
- **Browse verified games** — Every project on the platform has a developer whose identity is backed by their Steam history.
- **Check the receipts** — Before you invest, see the developer's account age, games owned, playtime, and community reputation. Make informed decisions.
- **Buy with confidence** — Tokens are launched on pump.fun's bonding curve, so pricing is transparent and automated. No hidden allocations.

---

## 🏗️ How it's built

This isn't a weekend hackathon project duct-taped together. It's a properly architected monorepo built for scale.

### Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Runtime** | React 19, Server Components & Server Actions |
| **Auth** | Steam OpenID 2.0 |
| **Blockchain** | Solana (Web3.js, SPL Token) |
| **Token Launch** | pump.fun SDK / API |
| **Monorepo** | Turborepo + pnpm workspaces |
| **Styling** | CSS Modules / Tailwind (TBD) |

### Project Structure

```
steam-verify/
├── apps/
│   └── web/                    # Main Next.js 15 application
│       └── app/
│           ├── page.tsx                    # Landing page
│           ├── developers/page.tsx         # Developer directory
│           ├── games/[appId]/page.tsx      # Individual game/token page
│           └── api/
│               ├── auth/steam/route.ts     # Steam OpenID callback
│               └── steam/app/[appId]/route.ts  # Steam app data API
├── node_modules/
├── package.json
└── README.md
```

### Architecture at a glance

```
┌──────────────┐     OpenID      ┌──────────────┐
│              │ ◄──────────────►│              │
│   Browser    │                 │  Steam API   │
│              │                 │              │
└──────┬───────┘                 └──────────────┘
       │
       │ HTTPS
       ▼
┌──────────────┐    Web3.js      ┌──────────────┐
│   Next.js    │ ◄──────────────►│   Solana     │
│   Server     │                 │  Blockchain  │
│  (App Router)│                 └──────────────┘
│              │
│              │   pump.fun SDK  ┌──────────────┐
│              │ ◄──────────────►│   pump.fun   │
└──────────────┘                 │   Protocol   │
                                 └──────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (20+ recommended)
- **pnpm** 8+ — `npm install -g pnpm`
- A **Steam Web API Key** — [Get one here](https://steamcommunity.com/dev/apikey)
- A **Solana wallet** with some SOL for transaction fees

### Installation

```bash
# Clone the repo
git clone https://github.com/repror/steam-verify.git

# Navigate into the project
cd steam-verify

# Install dependencies
pnpm install

# Set up your environment variables
cp apps/web/.env.example apps/web/.env.local
```

### Environment Variables

Create a `.env.local` file in `apps/web/` with the following:

```env
# Steam
STEAM_API_KEY=your_steam_api_key_here
NEXT_PUBLIC_STEAM_REALM=http://localhost:3000
STEAM_RETURN_URL=http://localhost:3000/api/auth/steam

# Solana
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_PRIVATE_KEY=your_wallet_private_key

# App
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000
```

### Run locally

```bash
# Start the dev server
pnpm dev
```

The app will be running at [http://localhost:3000](http://localhost:3000).

---

## 📄 API Routes

| Route | Method | Description |
|---|---|---|
| `/api/auth/steam` | `GET` | Handles Steam OpenID authentication callback |
| `/api/steam/app/[appId]` | `GET` | Fetches Steam app metadata (name, description, images) |

---

## 🗺️ Pages

| Path | Description |
|---|---|
| `/` | Landing page — hero, value prop, and CTA |
| `/developers` | Browse all verified developers and their trust scores |
| `/games/[appId]` | Individual game/project page with token info and developer verification status |

---

## 🔒 How the verification works

1. **User clicks "Sign in with Steam"** → Redirected to Steam's login page.
2. **Steam authenticates the user** → Sends back a signed OpenID response to our callback at `/api/auth/steam`.
3. **We fetch their public profile** → Account age, games owned, community status, VAC bans, etc.
4. **We compute a trust score** → Based on account maturity, activity, and standing.
5. **User is marked as "Verified"** → They can now interact with token launch features.

This is **not KYC**. We don't ask for IDs, selfies, or personal documents. We use publicly available Steam data as a lightweight, privacy-preserving reputation signal. It's not perfect, but it's a hell of a lot better than nothing — which is what most launchpads offer today.

---

## 🪙 How the token launch works

1. **Verified developer fills out their project details** — game name, description, tokenomics, etc.
2. **We generate an SPL token** on Solana using Web3.js.
3. **Token is listed on pump.fun's bonding curve** — anyone can buy in at a fair, algorithmically determined price.
4. **As demand increases, the price rises along the curve** — early supporters benefit, but there's no hidden pre-sale or team allocation undermining them.
5. **Developer receives funds** to build their game, mod, or project.

---

## 🛠️ Development

```bash
# Run dev server with hot reload
pnpm dev

# Type-check
pnpm typecheck

# Lint
pnpm lint

# Build for production
pnpm build
```

---

## 🤝 Contributing

This project is in active development. If you want to contribute:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

Please keep PRs focused and small. If you're planning something big, open an issue first so we can discuss it.

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Valve / Steam](https://store.steampowered.com/) — for the OpenID authentication system
- [pump.fun](https://pump.fun) — for making fair token launches accessible
- [Solana](https://solana.com) — for the fast, low-cost blockchain infrastructure
- [Next.js](https://nextjs.org) — for making full-stack React actually enjoyable

---

<p align="center">
  <b>Built with ☕ and mass amounts of skepticism about anonymous token launches.</b>
</p>
