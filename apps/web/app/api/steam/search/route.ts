import { prisma } from "@steam-verify/db";
import { NextRequest, NextResponse } from "next/server";
import { steamStoreSearch } from "@/lib/steam/store-api";

const Q_MIN = 2;
const Q_MAX = 120;

/**
 * Steam store search; each item includes `launched` when this app has a registered mint in our DB.
 * Next: `GET /api/steam/app/:id` for token fields + full `launch` summary.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < Q_MIN) {
    return NextResponse.json(
      { error: `Query "q" must be at least ${Q_MIN} characters` },
      { status: 400 },
    );
  }
  if (q.length > Q_MAX) {
    return NextResponse.json({ error: `Query "q" too long (max ${Q_MAX})` }, { status: 400 });
  }

  try {
    const { total, items } = await steamStoreSearch(q);
    const appIds = items.map((i) => i.id);
    const launchedRows =
      appIds.length > 0
        ? await prisma.tokenLaunch.findMany({
            where: {
              steamAppId: { in: appIds },
              mintAddress: { not: null },
            },
            select: { steamAppId: true },
          })
        : [];
    const launchedSet = new Set(launchedRows.map((r) => r.steamAppId));

    return NextResponse.json({
      total,
      items: items.map((i) => ({
        steamAppId: i.id,
        name: i.name,
        tinyImage: i.tiny_image ?? null,
        platforms: i.platforms ?? null,
        launched: launchedSet.has(i.id),
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Steam search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
