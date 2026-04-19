import { prisma } from "@steam-verify/db";
import { getSteamAppLaunchSummary } from "@/lib/steam/launch-status";
import { steamAppDetails } from "@/lib/steam/store-api";
import {
  buildPumpMetadataJson,
  steamAppDetailsToPumpFields,
  type PumpLaunchTokenFields,
} from "@/lib/token/steam-to-pump-metadata";
import { NextRequest, NextResponse } from "next/server";

const CACHE_MS = 24 * 60 * 60 * 1000;

type CachedMeta = {
  pump?: PumpLaunchTokenFields;
};

function readPumpFromCache(metadataJson: unknown): PumpLaunchTokenFields | null {
  if (!metadataJson || typeof metadataJson !== "object") return null;
  const pump = (metadataJson as CachedMeta).pump;
  if (!pump || typeof pump.steamAppId !== "number") return null;
  return pump;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ appId: string }> },
) {
  const { appId: raw } = await ctx.params;
  const appId = Number.parseInt(raw, 10);
  if (!Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  if (!refresh) {
    const row = await prisma.steamGame.findUnique({ where: { steamAppId: appId } });
    if (row && Date.now() - row.lastSyncedAt.getTime() < CACHE_MS) {
      const pump = readPumpFromCache(row.metadataJson);
      if (pump) {
        const launch = await getSteamAppLaunchSummary(appId);
        return NextResponse.json({
          source: "cache",
          steamAppId: appId,
          pump,
          metadata: buildPumpMetadataJson(pump),
          launch,
        });
      }
    }
  }

  let details;
  try {
    details = await steamAppDetails(appId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Steam appdetails failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!details) {
    return NextResponse.json({ error: "Unknown or delisted Steam app" }, { status: 404 });
  }

  const pump = steamAppDetailsToPumpFields(appId, details);
  if (!pump) {
    return NextResponse.json(
      { error: "Could not map Steam data (missing name)" },
      { status: 422 },
    );
  }

  await prisma.steamGame.upsert({
    where: { steamAppId: appId },
    create: {
      steamAppId: appId,
      name: pump.name,
      metadataJson: { pump, steam: details },
    },
    update: {
      name: pump.name,
      metadataJson: { pump, steam: details },
      lastSyncedAt: new Date(),
    },
  });

  const launch = await getSteamAppLaunchSummary(appId);

  return NextResponse.json({
    source: "steam",
    steamAppId: appId,
    pump,
    metadata: buildPumpMetadataJson(pump),
    launch,
  });
}
