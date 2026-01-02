import { fetchManifest } from "./fetcher";
import { flattenManifest } from "./differ/structural";
import { processFiles } from "./processor";
import { join, dirname } from "node:path";
import { mkdir } from "node:fs/promises";

const MANIFEST_PATH = join(import.meta.dir, "../data/manifest.json");

async function loadManifest() {
  const file = Bun.file(MANIFEST_PATH);
  if (await file.exists()) return file.json();
  return null;
}

async function saveManifest(manifest: unknown) {
  await mkdir(dirname(MANIFEST_PATH), { recursive: true });
  await Bun.write(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function main() {
  console.log("Fetching manifest...");
  const manifest = await fetchManifest();
  const files = flattenManifest(manifest.data);
  console.log(`Total files: ${files.length}`);

  const oldManifest = await loadManifest();
  const oldFiles = oldManifest ? flattenManifest(oldManifest.data) : [];
  const oldMap = new Map(oldFiles.map((f) => [f.path, f.hash]));

  const toProcess = files.filter((f) => oldMap.get(f.path) !== f.hash);

  if (toProcess.length === 0) {
    console.log("No changes.");
    return;
  }

  console.log(`Processing: ${toProcess.length} files`);

  await processFiles(toProcess, (current, total, path) => {
    console.log(`[${current}/${total}] ${path}`);
  });

  await saveManifest(manifest);
  console.log("Done.");
}

main().catch(console.error);
