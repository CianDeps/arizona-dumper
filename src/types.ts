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

export interface DffGeometry {
  index: number;
  vertices: number;
  triangles: number;
  materials: { color: unknown; texture: string | null }[];
}

export interface DffAnalysis {
  type: "dff";
  version: number;
  modelType: string;
  geometries: DffGeometry[];
  frames: number;
  dummies: string[];
}

export interface TxdTexture {
  name: string;
  width: number;
  height: number;
  format: string;
  alpha: boolean;
}

export interface TxdAnalysis {
  type: "txd";
  textures: TxdTexture[];
}

export interface IfpBone {
  name: string;
  keyframes: number;
}

export interface IfpAnimation {
  name: string;
  bones: IfpBone[];
}

export interface IfpAnalysis {
  type: "ifp";
  name: string;
  version: number;
  animations: IfpAnimation[];
}

export interface ImgEntry {
  name: string;
  size: number;
}

export interface ImgAnalysis {
  type: "img";
  version: "v1" | "v2";
  totalEntries: number;
  entries: ImgEntry[];
}

export interface ConfigAnalysis {
  type: "config";
  lines: number;
  content: string[];
}

export interface JsonAnalysis {
  type: "json";
  data?: unknown;
  error?: string;
  raw?: string;
}

export interface ZipEntry {
  name: string;
  size: number;
  compressedSize: number;
}

export interface ZipAnalysis {
  type: "zip";
  totalEntries: number;
  entries: ZipEntry[];
}

export interface BinaryAnalysis {
  type: "binary";
  size: number;
  md5: string;
}

export interface UnknownAnalysis {
  type: "unknown";
  size: number;
  md5: string;
}

export type AnalysisResult =
  | DffAnalysis
  | TxdAnalysis
  | IfpAnalysis
  | ImgAnalysis
  | ConfigAnalysis
  | JsonAnalysis
  | ZipAnalysis
  | BinaryAnalysis
  | UnknownAnalysis;
