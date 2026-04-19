import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@steam-verify/db";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ user: null });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    const res = NextResponse.json({ user: null });
    res.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }

  const user = await prisma.steamUser.findUnique({
    where: { steamId64: session.steamId64 },
    select: { steamId64: true, displayName: true, avatarUrl: true },
  });

  return NextResponse.json({ user });
}
