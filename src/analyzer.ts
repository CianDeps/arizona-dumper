import { DffParser, TxdParser, IfpParser } from "rw-parser-ng";
import { parseImg, extractEntry } from "./parsers/img";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

function md5(buffer: Buffer): string {
  return createHash("md5").update(buffer).digest("hex");
}

export function analyzeDff(buffer: Buffer) {
  const dff = new DffParser(buffer).parse();
  return {
    type: "dff",
    version: dff.version,
    modelType: dff.modelType,
    geometries:
      dff.geometryList?.geometries.map((g, i) => ({
        index: i,
        vertices: g.vertexInformation?.length ?? 0,
        triangles: g.triangleInformation?.length ?? 0,
        materials: g.materialList.materialData.map((m) => ({
          color: m.color,
          texture: m.texture?.name ?? null,
        })),
      })) ?? [],
    frames: dff.frameList?.frames.length ?? 0,
    dummies: dff.dummies,
  };
}

export function analyzeTxd(buffer: Buffer) {
  const txd = new TxdParser(buffer).parse();
  return {
    type: "txd",
    textures: txd.textureDictionary.textureNatives.map((t) => ({
      name: t.textureName,
      width: t.width,
      height: t.height,
      format: t.d3dFormat,
      alpha: t.alpha,
    })),
  };
}

export function analyzeIfp(buffer: Buffer) {
  const ifp = new IfpParser(buffer).parse();
  return {
    type: "ifp",
    name: ifp.name,
    version: ifp.version,
    animations: ifp.animations.map((a) => ({
      name: a.name,
      bones: a.bones.map((b) => ({
        name: b.name,
        keyframes: b.keyframes.length,
      })),
    })),
  };
}

export function analyzeImg(buffer: Buffer) {
  const img = parseImg(buffer);
  return {
    type: "img",
    version: img.version,
    entries: img.entries.map((e) => ({ name: e.name, size: e.size })),
  };
}

export function analyzeBinary(buffer: Buffer, path: string) {
  const strings = extractStrings(buffer);
  const imports = extractPEImports(buffer);
  const exports = extractPEExports(buffer);

  return {
    type: "binary",
    size: buffer.length,
    md5: md5(buffer),
    strings: strings.slice(0, 200),
    pe: imports.length > 0 || exports.length > 0 ? { imports, exports } : null,
  };
}

function extractStrings(buffer: Buffer, minLen = 6): string[] {
  const strings: string[] = [];
  let current = "";

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if (byte >= 0x20 && byte < 0x7f) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= minLen) strings.push(current);
      current = "";
    }
  }
  if (current.length >= minLen) strings.push(current);

  return [...new Set(strings)];
}

function extractPEImports(buffer: Buffer): string[] {
  if (buffer.length < 64) return [];
  if (buffer[0] !== 0x4d || buffer[1] !== 0x5a) return [];

  const imports: string[] = [];
  const str = buffer.toString("ascii");

  const dlls = str.match(/[A-Za-z0-9_]+\.dll/gi);
  if (dlls) imports.push(...new Set(dlls));

  return imports.slice(0, 50);
}

function extractPEExports(buffer: Buffer): string[] {
  if (buffer.length < 64) return [];
  if (buffer[0] !== 0x4d || buffer[1] !== 0x5a) return [];

  const exports: string[] = [];
  const strings = extractStrings(buffer, 4);

  for (const s of strings) {
    if (/^[A-Z][a-zA-Z0-9_]+$/.test(s) && s.length < 50) {
      exports.push(s);
    }
  }

  return exports.slice(0, 100);
}

export function analyzeConfig(buffer: Buffer) {
  const content = buffer.toString("utf8");
  const lines = content
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith(";") && !l.startsWith("#"));

  return {
    type: "config",
    lines: lines.length,
    content: lines.slice(0, 500),
  };
}

export function analyzeJson(buffer: Buffer) {
  try {
    const data = JSON.parse(buffer.toString("utf8"));
    return { type: "json", data };
  } catch {
    return {
      type: "json",
      error: "parse_failed",
      raw: buffer.toString("utf8").slice(0, 1000),
    };
  }
}

export function analyzeZip(buffer: Buffer) {
  const entries: { name: string; size: number; compressedSize: number }[] = [];
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );

  let offset = 0;
  while (offset < buffer.length - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;

    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = buffer.toString("utf8", offset + 30, offset + 30 + nameLength);

    if (uncompressedSize > 0 && !name.endsWith("/")) {
      entries.push({ name, size: uncompressedSize, compressedSize });
    }

    offset += 30 + nameLength + extraLength + compressedSize;
  }

  return {
    type: "zip",
    totalEntries: entries.length,
    entries,
  };
}

export function analyzeFile(buffer: Buffer, path: string) {
  const ext = path.toLowerCase().split(".").pop() ?? "";

  switch (ext) {
    case "dff":
      return analyzeDff(buffer);
    case "txd":
      return analyzeTxd(buffer);
    case "ifp":
      return analyzeIfp(buffer);
    case "img":
      return analyzeImg(buffer);
    case "asi":
    case "dll":
    case "exe":
      return analyzeBinary(buffer, path);
    case "ini":
    case "cfg":
    case "dat":
    case "txt":
    case "ide":
    case "ipl":
      return analyzeConfig(buffer);
    case "json":
      return analyzeJson(buffer);
    case "zip":
      return analyzeZip(buffer);
    default:
      return {
        type: "unknown",
        size: buffer.length,
        md5: md5(buffer),
      };
  }
}
