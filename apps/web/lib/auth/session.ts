import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "sv_session";

function getSecret(): Uint8Array {
  const secret = process.env.STEAM_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("STEAM_SESSION_SECRET must be set (min 16 characters)");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  steamId64: string;
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ steamId64: payload.steamId64 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.steamId64)
    .setIssuedAt()
    .setExpirationTime(process.env.STEAM_SESSION_MAX_AGE ?? "7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const steamId64 = typeof payload.steamId64 === "string" ? payload.steamId64 : payload.sub;
    if (typeof steamId64 !== "string" || !/^\d{17,18}$/.test(steamId64)) {
      return null;
    }
    return { steamId64 };
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
