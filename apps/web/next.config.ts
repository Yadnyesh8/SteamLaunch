import type { NextConfig } from "next";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

/** Monorepo root (steam-verify), so Next resolves deps from this workspace, not a parent lockfile. */
const workspaceRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const require = createRequire(import.meta.url);
const pumpSdkRoot = path.dirname(path.dirname(require.resolve("@nirholas/pump-sdk")));

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  /** Turbopack ignores `webpack`; use a project-relative alias (absolute paths break Turbopack). */
  turbopack: {
    resolveAlias: {
      "@nirholas/pump-sdk": "./node_modules/@nirholas/pump-sdk",
    },
  },
  transpilePackages: [
    "@steam-verify/db",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-phantom",
    "@solana/wallet-adapter-solflare",
  ],
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "@nirholas/pump-sdk",
    "puppeteer",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
    "playwright",
  ],
  webpack: (config, { webpack: webpackApi }) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@nirholas/pump-sdk": pumpSdkRoot,
    };
    config.plugins = config.plugins ?? [];
    config.plugins.push(
      new webpackApi.IgnorePlugin({ resourceRegExp: /^pino-pretty$/ }),
    );
    return config;
  },
};

export default nextConfig;
