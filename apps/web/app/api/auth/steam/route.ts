import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  OAUTH_POST_LOGIN_REDIRECT_COOKIE,
  sanitizePostLoginRedirect,
} from "@/lib/auth/oauth-redirect";
import { buildSteamPartnerAuthorizeUrl } from "@/lib/steam/partner-oauth";

const STATE_COOKIE = "sv_steam_oauth_state";
const STATE_MAX_AGE = 600;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing ${name}`);
  }
  return v;
}

/**
 * Starts Steamworks Partner OAuth. Redirect URI is fixed in Valve’s client config;
 * it must match this app’s `/auth/steam/callback` page exactly.
 *
 * @see https://partner.steamgames.com/doc/webapi_overview/oauth
 */
export async function GET(req: NextRequest) {
  let clientId: string;
  try {
    clientId = requireEnv("STEAM_OAUTH_CLIENT_ID");
  } catch {
    return NextResponse.json(
      { error: "Server misconfiguration: STEAM_OAUTH_CLIENT_ID" },
      { status: 500 },
    );
  }

  const responseType = process.env.STEAM_OAUTH_RESPONSE_TYPE === "code" ? "code" : "token";
  const mobileMinimal = process.env.STEAM_OAUTH_MOBILE_MINIMAL === "1";

  const state = randomBytes(24).toString("hex");
  const url = buildSteamPartnerAuthorizeUrl({
    clientId,
    state,
    responseType,
    mobileMinimal,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE,
  });

  const nextPath = sanitizePostLoginRedirect(req.nextUrl.searchParams.get("redirect"));
  if (nextPath) {
    res.cookies.set(OAUTH_POST_LOGIN_REDIRECT_COOKIE, nextPath, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STATE_MAX_AGE,
    });
  } else {
    res.cookies.set(OAUTH_POST_LOGIN_REDIRECT_COOKIE, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
  }

  return res;
}
