import type { PumpLaunchTokenFields } from "@/lib/token/steam-to-pump-metadata";
import { steamLibraryCapsuleUrl } from "@/lib/steam/steam-cover-images";

type CachedMeta = { pump?: PumpLaunchTokenFields };

function readPump(metadataJson: unknown): PumpLaunchTokenFields | null {
  if (!metadataJson || typeof metadataJson !== "object") return null;
  const pump = (metadataJson as CachedMeta).pump;
  if (!pump || typeof pump.steamAppId !== "number") return null;
  return pump;
}

function fallbackSymbol(gameName: string, steamAppId: number): string {
  const alnum = gameName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (alnum.length >= 2) return alnum.slice(0, 10);
  return `APP${steamAppId}`;
}

/** Display fields for a launched token from `SteamGame` + optional cached pump metadata. */
export function launchDisplayFromGame(
  steamAppId: number,
  gameName: string,
  metadataJson: unknown,
): { name: string; symbol: string; image: string } {
  const pump = readPump(metadataJson);
  if (pump) {
    return { name: pump.name, symbol: pump.symbol, image: pump.image };
  }
  return {
    name: gameName,
    symbol: fallbackSymbol(gameName, steamAppId),
    image: steamLibraryCapsuleUrl(steamAppId),
  };
}
