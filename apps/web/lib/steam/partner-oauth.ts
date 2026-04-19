/**
 * Steamworks Partner OAuth (OAuth 2.0–style).
 * @see https://partner.steamgames.com/doc/webapi_overview/oauth
 */

const STEAM_OAUTH_LOGIN = "https://steamcommunity.com/oauth/login";
const GET_TOKEN_DETAILS =
  "https://api.steampowered.com/ISteamUserOAuth/GetTokenDetails/v1/";

export type SteamOAuthResponseType = "token" | "code";

export function buildSteamPartnerAuthorizeUrl(params: {
  clientId: string;
  state: string;
  responseType: SteamOAuthResponseType;
  /** Recommended for embedded / in-game web views */
  mobileMinimal?: boolean;
}): string {
  const u = new URL(STEAM_OAUTH_LOGIN);
  u.searchParams.set("response_type", params.responseType);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("state", params.state);
  if (params.mobileMinimal) {
    u.searchParams.set("mobileminimal", "1");
  }
  return u.toString();
}

export type SteamTokenDetails = {
  steamId64: string;
  raw: unknown;
};

/**
 * Server-to-server: resolve SteamID for an OAuth access_token.
 * Some partner setups may require your Web API publisher key — pass it if Valve enabled it for this call.
 */
export async function getSteamIdFromPartnerAccessToken(
  accessToken: string,
  publisherWebApiKey?: string,
): Promise<SteamTokenDetails> {
  const url = new URL(GET_TOKEN_DETAILS);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("format", "json");
  if (publisherWebApiKey) {
    url.searchParams.set("key", publisherWebApiKey);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`GetTokenDetails HTTP ${res.status}`);
  }

  const steamId64 = extractSteamId64FromTokenDetails(raw);
  if (!steamId64) {
    throw new Error("GetTokenDetails: missing steamid in response");
  }

  return { steamId64, raw };
}

function extractSteamId64FromTokenDetails(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const r = body as Record<string, unknown>;
  const response = r.response;
  if (!response || typeof response !== "object") return null;
  const params = (response as Record<string, unknown>).params;
  if (!params || typeof params !== "object") return null;
  const steamid = (params as Record<string, unknown>).steamid;
  const s = typeof steamid === "number" ? String(steamid) : typeof steamid === "string" ? steamid : null;
  if (s && /^\d{17,18}$/.test(s)) {
    return s;
  }
  return null;
}
