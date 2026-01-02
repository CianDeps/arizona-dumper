import type { Manifest } from "./types";

const MANIFEST_URL = "https://pc.az-ins.com/release/game.json";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function fetchWithRetry(
  url: string,
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status >= 500 && attempt < retries) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }
  throw new Error("Unreachable");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchManifest(): Promise<Manifest> {
  const response = await fetchWithRetry(MANIFEST_URL);
  return response.json();
}

export function getFileUrl(path: string): string {
  return `https://pc.az-ins.com/release/game/${path}`;
}

export async function downloadFile(path: string): Promise<Buffer> {
  const response = await fetchWithRetry(getFileUrl(path));
  return Buffer.from(await response.arrayBuffer());
}
