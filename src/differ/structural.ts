import type { Manifest, ManifestEntry, FlatFile, DiffResult } from "../types";

export function flattenManifest(entries: ManifestEntry[], prefix = ""): FlatFile[] {
  const files: FlatFile[] = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.type === "dir" && entry.data) {
      files.push(...flattenManifest(entry.data, path));
    } else {
      files.push({
        path,
        type: entry.type,
        size: entry.size,
        hash: entry.hash ?? "",
        date_change: entry.date_change ?? 0,
      });
    }
  }
  return files;
}

export function diffManifests(oldManifest: Manifest, newManifest: Manifest): DiffResult {
  const oldFiles = flattenManifest(oldManifest.data);
  const newFiles = flattenManifest(newManifest.data);

  const oldMap = new Map(oldFiles.map((f) => [f.path, f]));
  const newMap = new Map(newFiles.map((f) => [f.path, f]));

  const added: FlatFile[] = [];
  const removed: FlatFile[] = [];
  const changed: FlatFile[] = [];

  for (const [path, file] of newMap) {
    const old = oldMap.get(path);
    if (!old) {
      added.push(file);
    } else if (old.hash !== file.hash) {
      changed.push(file);
    }
  }

  for (const [path, file] of oldMap) {
    if (!newMap.has(path)) {
      removed.push(file);
    }
  }

  return { added, removed, changed };
}
