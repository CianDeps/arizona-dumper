export type FileType = "file" | "check" | "res" | "dir";

export interface ManifestEntry {
  type: FileType;
  name: string;
  size: number;
  hash?: string;
  date_change?: number;
  data?: ManifestEntry[];
}

export interface Manifest {
  data: ManifestEntry[];
}

export interface FlatFile {
  path: string;
  type: FileType;
  size: number;
  hash: string;
  date_change: number;
}

export interface DiffResult {
  added: FlatFile[];
  removed: FlatFile[];
  changed: FlatFile[];
}
