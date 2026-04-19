/**
 * Pinata uploads via the official SDK (v3 Files API).
 * @see https://docs.pinata.cloud/frameworks/next-js
 */

import { PinataSDK } from "pinata";

export type PinJsonResult = { IpfsHash: string; PinSize?: number };

function pinataGatewayHost(): string | undefined {
  const g =
    process.env.PINATA_GATEWAY?.trim() || process.env.NEXT_PUBLIC_GATEWAY_URL?.trim();
  return g || undefined;
}

function createPinata(): PinataSDK {
  const pinataJwt = process.env.PINATA_JWT?.trim();
  const pinataGateway = pinataGatewayHost();
  if (!pinataJwt) {
    throw new Error("PINATA_JWT is not set");
  }
  if (!pinataGateway) {
    throw new Error(
      "Set PINATA_GATEWAY or NEXT_PUBLIC_GATEWAY_URL to your Pinata gateway host (e.g. my-gateway.mypinata.cloud). See https://docs.pinata.cloud/frameworks/next-js",
    );
  }
  return new PinataSDK({ pinataJwt, pinataGateway });
}

export function isPinataConfigured(): boolean {
  return Boolean(process.env.PINATA_JWT?.trim() && pinataGatewayHost());
}

export async function pinataPinFile(params: {
  fileName: string;
  contentType: string;
  bytes: Buffer;
}): Promise<PinJsonResult> {
  const pinata = createPinata();
  const u8 = new Uint8Array(params.bytes);
  const blob = new Blob([u8], { type: params.contentType });
  const file = new File([blob], params.fileName, { type: params.contentType });
  const upload = await pinata.upload.public.file(file).name(params.fileName).cidVersion("v1");
  return { IpfsHash: upload.cid };
}

export async function pinataPinJson(params: {
  name: string;
  json: Record<string, unknown>;
}): Promise<PinJsonResult> {
  const pinata = createPinata();
  const upload = await pinata.upload.public.json(params.json).name(params.name).cidVersion("v1");
  return { IpfsHash: upload.cid };
}

export function ipfsUriFromCid(cid: string): string {
  return `ipfs://${cid}`;
}
