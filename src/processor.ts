import { downloadFile } from "./fetcher";
import { analyzeFile, analyzeDff, analyzeTxd, analyzeIfp } from "./analyzer";
import { parseImg, extractEntry } from "./parsers/img";
import { mapConcurrent } from "./utils/concurrency";
import type { FlatFile } from "./types";
import { join, dirname } from "node:path";
import { mkdir } from "node:fs/promises";

const PARSED_DIR = join(import.meta.dir, "../parsed");
const CONCURRENCY = 8;

async function saveJson(path: string, data: unknown): Promise<void> {
  const ext = path.toLowerCase().endsWith(".json") ? "" : ".json";
  const fullPath = join(PARSED_DIR, path + ext);
  await mkdir(dirname(fullPath), { recursive: true });
  await Bun.write(fullPath, JSON.stringify(data, null, 2));
}

async function processImg(path: string, buffer: Buffer): Promise<void> {
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
    } catch {
      console.error(`  Failed: ${entry.name}`);
    }
  }
}

async function processFile(path: string, buffer: Buffer): Promise<void> {
  const ext = path.toLowerCase().split(".").pop() ?? "";

  if (ext === "img") {
    await processImg(path, buffer);
    return;
  }

  const analysis = analyzeFile(buffer, path);
  await saveJson(path, analysis);
}

export async function processFiles(
  files: FlatFile[],
  onProgress?: (current: number, total: number, path: string) => void,
): Promise<void> {
  await mapConcurrent(files, CONCURRENCY, async (file, index) => {
    onProgress?.(index + 1, files.length, file.path);

    try {
      const buffer = await downloadFile(file.path);
      await processFile(file.path, buffer);
    } catch (err) {
      console.error(`Failed: ${file.path}`, err);
    }
  });
}
