import { ExifTool } from 'exiftool-vendored';
import path from 'node:path';
import fs from 'node:fs';

let exiftool = null;

export function getExifTool() {
  if (!exiftool) {
    exiftool = new ExifTool({ taskTimeoutMillis: 10000 });
  }
  return exiftool;
}

export async function parseMetadata(filePath) {
  try {
    const et = getExifTool();
    const tags = await et.read(filePath);
    return tags;
  } catch (error) {
    console.error('[ExifToolService] Error parsing metadata:', error);
    return null;
  }
}

export async function closeExifTool() {
  if (exiftool) {
    await exiftool.end();
    exiftool = null;
  }
}
