import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@steam-verify/db";
import {
  OAUTH_POST_LOGIN_REDIRECT_COOKIE,
  sanitizePostLoginRedirect,
} from "@/lib/auth/oauth-redirect";
import { COOKIE_NAME, createSessionToken } from "@/lib/auth/session";
import { getSteamIdFromPartnerAccessToken } from "@/lib/steam/partner-oauth";

const STATE_COOKIE = "sv_steam_oauth_state";

type Body = {
  access_token?: string;
  state?: string;
};

/**
 * Accepts the OAuth access_token from the browser (fragment is not visible to the server).
 * Verifies CSRF `state` against the httpOnly cookie, resolves SteamID via GetTokenDetails, upserts user, sets session.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const accessToken = body.access_token?.trim();
  const state = body.state?.trim();
  if (!accessToken || !state) {
    return NextResponse.json({ error: "access_token and state required" }, { status: 400 });
  }

  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 403 });
  }

  const publisherKey = process.env.STEAM_WEB_API_KEY;

  let steamId64: string;
  try {
    const details = await getSteamIdFromPartnerAccessToken(accessToken, publisherKey);
    steamId64 = details.steamId64;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Token validation failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  if (publisherKey) {
    try {
      const summary = await fetchPlayerSummary(publisherKey, steamId64);
      displayName = summary?.personaname ?? null;
      avatarUrl = summary?.avatarfull ?? summary?.avatarmedium ?? null;
    } catch {
      /* optional enrichment */
    }
  }

  await prisma.steamUser.upsert({
    where: { steamId64 },
    create: { steamId64, displayName, avatarUrl },
    update: {
      ...(displayName != null ? { displayName } : {}),
      ...(avatarUrl != null ? { avatarUrl } : {}),
    },
  });

  let sessionJwt: string;
  try {
    sessionJwt = await createSessionToken({ steamId64 });
  } catch {
    return NextResponse.json(
      { error: "Server misconfiguration: STEAM_SESSION_SECRET" },
      { status: 500 },
    );
  }

  const redirectRaw = req.cookies.get(OAUTH_POST_LOGIN_REDIRECT_COOKIE)?.value;
  const redirect = sanitizePostLoginRedirect(redirectRaw) ?? "/";

  const res = NextResponse.json({ ok: true, steamId64, redirect });
  res.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(OAUTH_POST_LOGIN_REDIRECT_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(COOKIE_NAME, sessionJwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}

type PlayerSummary = {
  personaname?: string;
  avatarmedium?: string;
  avatarfull?: string;
};

async function fetchPlayerSummary(
  webApiKey: string,
  steamId64: string,
): Promise<PlayerSummary | null> {
  const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/");
  url.searchParams.set("key", webApiKey);
  url.searchParams.set("steamids", steamId64);
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    response?: { players?: PlayerSummary[] };
  };
  const p = data.response?.players?.[0];
  return p ?? null;
}
