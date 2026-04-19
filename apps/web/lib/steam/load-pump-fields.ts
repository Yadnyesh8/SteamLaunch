import { prisma } from "@steam-verify/db";
import { steamAppDetails } from "@/lib/steam/store-api";
import {
  steamAppDetailsToPumpFields,
  type PumpLaunchTokenFields,
} from "@/lib/token/steam-to-pump-metadata";

type CachedMeta = { pump?: PumpLaunchTokenFields };

function pumpFromRow(metadataJson: unknown): PumpLaunchTokenFields | null {
  if (!metadataJson || typeof metadataJson !== "object") return null;
  const pump = (metadataJson as CachedMeta).pump;
  if (!pump || typeof pump.steamAppId !== "number") return null;
  return pump;
}

/** Prefer DB cache; fall back to live Steam appdetails. */
export async function loadPumpFieldsForApp(
  appId: number,
): Promise<PumpLaunchTokenFields | null> {
  const row = await prisma.steamGame.findUnique({
    where: { steamAppId: appId },
  });
  const cached = row ? pumpFromRow(row.metadataJson) : null;
  if (cached) return cached;

  const details = await steamAppDetails(appId);
  if (!details) return null;
  return steamAppDetailsToPumpFields(appId, details);
}
