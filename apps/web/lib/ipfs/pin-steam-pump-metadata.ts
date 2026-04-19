import { ipfsUriFromCid, pinataPinFile, pinataPinJson } from "@/lib/ipfs/pinata";
import { getGamePageUrl } from "@/lib/site-url";
import { buildPumpMetadataJson, type PumpLaunchTokenFields } from "@/lib/token/steam-to-pump-metadata";
import { fetchSteamCoverForPinning } from "@/lib/steam/steam-cover-images";

/**
 * Downloads Steam cover art, pins image + Metaplex-style JSON to IPFS via Pinata.
 * Returns the token metadata URI for Pump `createV2` (`uri` field).
 */
export async function pinSteamPumpMetadataToIpfs(params: {
  appId: number;
  pump: PumpLaunchTokenFields;
}): Promise<{ metadataUri: string; imageCid: string; jsonCid: string; coverSource: string }> {
  const { appId, pump } = params;

  const cover = await fetchSteamCoverForPinning(appId, {
    capsule: pump.storeCapsuleForFallback ?? null,
    header: pump.storeHeaderForFallback ?? pump.banner ?? null,
  });
  const imagePin = await pinataPinFile({
    fileName: cover.filename,
    contentType: cover.contentType,
    bytes: cover.bytes,
  });

  const imageUri = ipfsUriFromCid(imagePin.IpfsHash);

  const metaBody = buildPumpMetadataJson({
    ...pump,
    image: imageUri,
    banner: pump.banner ? pump.banner : imageUri,
    externalUrl: getGamePageUrl(appId),
  });

  const jsonPin = await pinataPinJson({
    name: `steam-fund-${appId}-pump-metadata.json`,
    json: metaBody,
  });

  return {
    metadataUri: ipfsUriFromCid(jsonPin.IpfsHash),
    imageCid: imagePin.IpfsHash,
    jsonCid: jsonPin.IpfsHash,
    coverSource: cover.source,
  };
}
