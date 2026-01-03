import { fetchManifest, downloadFile } from "../src/fetcher";
import { flattenManifest } from "../src/differ/structural";
import { mapConcurrent } from "../src/utils/concurrency";
import { mkdir } from "fs/promises";
import { dirname, join } from "path";

const OUTPUT_DIR = process.argv[2] || "game";
const CONCURRENCY = 64;

async function ensureDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

async function main() {
  console.log("Fetching manifest...");
  const manifest = await fetchManifest();
  const files = flattenManifest(manifest.data).filter((f) => f.type !== "dir");

  console.log(`Downloading ${files.length} files to ${OUTPUT_DIR}/`);

  let completed = 0;

  await mapConcurrent(files, CONCURRENCY, async (file) => {
    const outPath = join(OUTPUT_DIR, file.path);
    await ensureDir(outPath);

    try {
      const buffer = await downloadFile(file.path);
      await Bun.write(outPath, buffer);
      completed++;
      console.log(`[${completed}/${files.length}] ${file.path}`);
    } catch (err) {
      console.error(`Failed: ${file.path}`, err);
      throw err;
    }
  });

  await Bun.write(join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
