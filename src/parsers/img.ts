export interface ImgEntry {
  offset: number;
  size: number;
  name: string;
}

export interface ImgArchive {
  version: "v1" | "v2";
  entries: ImgEntry[];
}

function parseName(buffer: Buffer, start: number, end: number): string {
  const raw = buffer.subarray(start, end);
  const nullIdx = raw.indexOf(0);
  return raw
    .subarray(0, nullIdx === -1 ? raw.length : nullIdx)
    .toString("ascii");
}

export function parseImg(buffer: Buffer): ImgArchive {
  const magic = buffer.toString("ascii", 0, 4);
  return magic === "VER2" ? parseImgV2(buffer) : parseImgV1(buffer);
}

function parseImgV1(buffer: Buffer): ImgArchive {
  const entries: ImgEntry[] = [];
  const entryCount = buffer.length / 32;

  for (let i = 0; i < entryCount; i++) {
    const base = i * 32;
    const offset = buffer.readUInt32LE(base) * 2048;
    const size = buffer.readUInt32LE(base + 4) * 2048;
    const name = parseName(buffer, base + 8, base + 32);
    if (name) entries.push({ offset, size, name });
  }

  return { version: "v1", entries };
}

function parseImgV2(buffer: Buffer): ImgArchive {
  const entryCount = buffer.readUInt32LE(4);
  const entries: ImgEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    const base = 8 + i * 32;
    const offset = buffer.readUInt32LE(base) * 2048;
    const sizeSecondary = buffer.readUInt16LE(base + 4);
    const sizePrimary = buffer.readUInt16LE(base + 6);
    const size = (sizePrimary || sizeSecondary) * 2048;
    const name = parseName(buffer, base + 8, base + 32);
    if (name) entries.push({ offset, size, name });
  }

  return { version: "v2", entries };
}

export function extractEntry(imgBuffer: Buffer, entry: ImgEntry): Buffer {
  const raw = imgBuffer.subarray(entry.offset, entry.offset + entry.size);
  return trimToRealSize(raw);
}

function trimToRealSize(buffer: Buffer): Buffer {
  if (buffer.length < 12) return buffer;

  const sectionId = buffer.readUInt32LE(0);

  if (sectionId === 0x10 || sectionId === 0x16) {
    const sectionSize = buffer.readUInt32LE(4);
    const realSize = sectionSize + 12;
    if (realSize > 0 && realSize <= buffer.length) {
      return buffer.subarray(0, realSize);
    }
  }

  return buffer;
}
