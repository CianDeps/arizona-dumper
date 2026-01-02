import { NtExecutable, NtExecutableResource } from "pe-library";

const RT_VERSION = 16;

export interface PEImport {
  dll: string;
  functions: string[];
}

export interface PEExport {
  name: string;
  ordinal: number;
}

export interface PESection {
  name: string;
  virtualSize: number;
  rawSize: number;
  characteristics: number;
}

export interface PEVersionInfo {
  fileVersion: string | null;
  productVersion: string | null;
  companyName: string | null;
  productName: string | null;
  fileDescription: string | null;
  originalFilename: string | null;
}

export interface PEAnalysis {
  type: "pe";
  machine: string;
  characteristics: number;
  timestamp: number;
  entryPoint: number;
  imageBase: number;
  sections: PESection[];
  imports: PEImport[];
  exports: PEExport[];
  version: PEVersionInfo | null;
}

const MACHINE_TYPES: Record<number, string> = {
  0x014c: "i386",
  0x0200: "ia64",
  0x8664: "amd64",
  0xaa64: "arm64",
};

export function parsePE(buffer: Buffer): PEAnalysis | null {
  try {
    const exe = NtExecutable.from(buffer);
    const fileHeader = exe.newHeader.fileHeader;
    const optHeader = exe.newHeader.optionalHeader;

    const sections = exe.getAllSections().map((s) => ({
      name: s.info.name,
      virtualSize: s.info.virtualSize,
      rawSize: s.info.sizeOfRawData,
      characteristics: s.info.characteristics,
    }));

    const imports = parseImports(exe);
    const exports = parseExports(exe);
    const version = parseVersionInfo(buffer);

    return {
      type: "pe",
      machine:
        MACHINE_TYPES[fileHeader.machine] ??
        `0x${fileHeader.machine.toString(16)}`,
      characteristics: fileHeader.characteristics,
      timestamp: fileHeader.timeDateStamp,
      entryPoint: optHeader.addressOfEntryPoint,
      imageBase: optHeader.imageBase,
      sections,
      imports,
      exports,
      version,
    };
  } catch {
    return null;
  }
}

function parseImports(exe: NtExecutable): PEImport[] {
  const imports: PEImport[] = [];
  const importDir = exe.newHeader.optionalHeaderDataDirectory.importTable;

  if (!importDir.virtualAddress) return imports;

  try {
    const section = exe.getSectionByEntry(importDir.virtualAddress);
    if (!section?.data) return imports;

    const rva = importDir.virtualAddress;
    const sectionRva = section.info.virtualAddress;
    const offset = rva - sectionRva;
    const data = Buffer.from(section.data);

    let pos = offset;
    while (pos + 20 <= data.length) {
      const nameRva = data.readUInt32LE(pos + 12);
      const iltRva = data.readUInt32LE(pos) || data.readUInt32LE(pos + 16);

      if (!nameRva) break;

      const dllName = readString(data, nameRva - sectionRva);
      const functions = readImportFunctions(exe, iltRva, sectionRva);

      if (dllName) {
        imports.push({ dll: dllName, functions });
      }

      pos += 20;
    }
  } catch {}

  return imports;
}

function readImportFunctions(
  exe: NtExecutable,
  iltRva: number,
  sectionRva: number,
): string[] {
  const functions: string[] = [];
  if (!iltRva) return functions;

  try {
    const section = exe.getSectionByEntry(iltRva);
    if (!section?.data) return functions;

    const data = Buffer.from(section.data);
    const is64 = exe.newHeader.optionalHeader.magic === 0x20b;
    const entrySize = is64 ? 8 : 4;
    let pos = iltRva - section.info.virtualAddress;

    while (pos + entrySize <= data.length) {
      const entry = is64
        ? Number(data.readBigUInt64LE(pos))
        : data.readUInt32LE(pos);
      if (!entry) break;

      const isOrdinal = is64
        ? entry >= 0x8000000000000000n
        : entry >= 0x80000000;
      if (!isOrdinal) {
        const hintNameRva = entry & 0x7fffffff;
        const hintSection = exe.getSectionByEntry(hintNameRva);
        if (hintSection?.data) {
          const hintData = Buffer.from(hintSection.data);
          const hintOffset = hintNameRva - hintSection.info.virtualAddress;
          const name = readString(hintData, hintOffset + 2);
          if (name) functions.push(name);
        }
      }

      pos += entrySize;
    }
  } catch {}

  return functions;
}

function parseExports(exe: NtExecutable): PEExport[] {
  const exports: PEExport[] = [];
  const exportDir = exe.newHeader.optionalHeaderDataDirectory.exportTable;

  if (!exportDir.virtualAddress) return exports;

  try {
    const section = exe.getSectionByEntry(exportDir.virtualAddress);
    if (!section?.data) return exports;

    const data = Buffer.from(section.data);
    const sectionRva = section.info.virtualAddress;
    const offset = exportDir.virtualAddress - sectionRva;

    const numberOfNames = data.readUInt32LE(offset + 24);
    const namePointerRva = data.readUInt32LE(offset + 32);
    const ordinalTableRva = data.readUInt32LE(offset + 36);
    const ordinalBase = data.readUInt32LE(offset + 16);

    const namePointerOffset = namePointerRva - sectionRva;
    const ordinalOffset = ordinalTableRva - sectionRva;

    for (let i = 0; i < numberOfNames; i++) {
      const nameRva = data.readUInt32LE(namePointerOffset + i * 4);
      const ordinal = data.readUInt16LE(ordinalOffset + i * 2) + ordinalBase;
      const name = readString(data, nameRva - sectionRva);

      if (name) {
        exports.push({ name, ordinal });
      }
    }
  } catch {}

  return exports;
}

function parseVersionInfo(buffer: Buffer): PEVersionInfo | null {
  try {
    const res = NtExecutableResource.from(NtExecutable.from(buffer));
    const versionEntries = res.entries.filter((e) => e.type === RT_VERSION);

    if (!versionEntries.length) return null;

    const versionData = versionEntries[0].bin;
    if (!versionData) return null;

    const info: PEVersionInfo = {
      fileVersion: null,
      productVersion: null,
      companyName: null,
      productName: null,
      fileDescription: null,
      originalFilename: null,
    };

    const dataBuffer = Buffer.from(versionData);
    const str = dataBuffer.toString("utf16le");

    const extractString = (key: string): string | null => {
      const pattern = new RegExp(key + "\\x00([^\\x00]+)", "i");
      const match = str.match(pattern);
      return match ? match[1].replace(/\x00/g, "") : null;
    };

    info.fileVersion = extractString("FileVersion");
    info.productVersion = extractString("ProductVersion");
    info.companyName = extractString("CompanyName");
    info.productName = extractString("ProductName");
    info.fileDescription = extractString("FileDescription");
    info.originalFilename = extractString("OriginalFilename");

    return info;
  } catch {
    return null;
  }
}

function readString(buffer: Buffer, offset: number): string {
  if (offset < 0 || offset >= buffer.length) return "";
  const end = buffer.indexOf(0, offset);
  return buffer.toString("ascii", offset, end === -1 ? undefined : end);
}
