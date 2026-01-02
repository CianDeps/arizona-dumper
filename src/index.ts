import { fetchManifest, downloadFile } from "./fetcher";
import { flattenManifest } from "./differ/structural";
import { analyzeFile, analyzeDff, analyzeTxd, analyzeIfp } from "./analyzer";
import { parseImg, extractEntry } from "./parsers/img";
import { join, dirname } from "node:path";
import { mkdir } from "node:fs/promises";

const PARSED_DIR = join(import.meta.dir, "../parsed");
const MANIFEST_PATH = join(import.meta.dir, "../data/manifest.json");

async function saveJson(path: string, data: unknown) {
  const ext = path.toLowerCase().endsWith(".json") ? "" : ".json";
  const fullPath = join(PARSED_DIR, path + ext);
  await mkdir(dirname(fullPath), { recursive: true });
  await Bun.write(fullPath, JSON.stringify(data, null, 2));
}

async function loadManifest() {
  const file = Bun.file(MANIFEST_PATH);
  if (await file.exists()) return file.json();
  return null;
}

async function saveManifest(manifest: unknown) {
  await mkdir(dirname(MANIFEST_PATH), { recursive: true });
  await Bun.write(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function processImg(path: string, buffer: Buffer) {
  const img = parseImg(buffer);

  await saveJson(path, {
    type: "img",
    version: img.version,
    totalEntries: img.entries.length,
    entries: img.entries.map((e) => ({ name: e.name, size: e.size })),
  });

  for (const entry of img.entries) {
    const ext = entry.name.toLowerCase().split(".").pop() ?? "";
    if (!["dff", "txd", "ifp"].includes(ext)) continue;

    try {
      const data = extractEntry(buffer, entry);
      const entryPath = `${path}/${entry.name}`;

      if (ext === "dff") await saveJson(entryPath, analyzeDff(data));
      else if (ext === "txd") await saveJson(entryPath, analyzeTxd(data));
      else if (ext === "ifp") await saveJson(entryPath, analyzeIfp(data));
    } catch (err) {
      console.error(`  Failed: ${entry.name}`);
    }
  }
}

async function processFile(path: string, buffer: Buffer) {
  const ext = path.toLowerCase().split(".").pop() ?? "";

  if (ext === "img") {
    await processImg(path, buffer);
    return;
  }

  const analysis = analyzeFile(buffer, path);
  await saveJson(path, analysis);
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

  for (let i = 0; i < toProcess.length; i++) {
    const file = toProcess[i];
    console.log(`[${i + 1}/${toProcess.length}] ${file.path}`);

    try {
      const buffer = await downloadFile(file.path);
      await processFile(file.path, buffer);
    } catch (err) {
      console.error(`Failed: ${file.path}`, err);
    }
  }

  await saveManifest(manifest);
  console.log("Done.");
}

main().catch(console.error);
