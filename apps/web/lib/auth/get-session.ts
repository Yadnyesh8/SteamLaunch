import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken, type SessionPayload } from "./session";

export async function getSteamSession(
  req: NextRequest,
): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
