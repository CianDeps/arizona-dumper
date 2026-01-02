import type { Manifest } from "./types";

const MANIFEST_URL = "https://pc.az-ins.com/release/game.json";

export async function fetchManifest(): Promise<Manifest> {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status}`);
  }
  return response.json();
}

export function getFileUrl(path: string): string {
  return `https://pc.az-ins.com/release/game/${path}`;
}

export async function downloadFile(path: string): Promise<Buffer> {
  const response = await fetch(getFileUrl(path));
  if (!response.ok) {
    throw new Error(`Failed to download ${path}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
