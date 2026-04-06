import { ExifTool } from 'exiftool-vendored';
import path from 'node:path';
import fs from 'node:fs';
import { getDb } from './db.js';

let exiftool = null;

function getExifTool() {
  if (!exiftool) {
    exiftool = new ExifTool({ taskTimeoutMillis: 30000 });
  }
  return exiftool;
}

function getNestedValue(obj, path) {
  if (!path || !obj) return undefined;
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return value;
}

function applyValueMap(value, valueMap) {
  if (!valueMap || !value) return value;
  const key = String(value);
  return valueMap[key] !== undefined ? valueMap[key] : value;
}

function resolveCombinedValue(metadata, field, configByKey) {
  if (!field.isCombined || !Array.isArray(field.combinedFields) || field.combinedFields.length === 0) {
    return undefined;
  }

  const parts = [];
  for (const combinedKey of field.combinedFields) {
    const subField = configByKey.get(combinedKey);
    if (!subField?.jsonPath) continue;
    const subValue = getNestedValue(metadata, subField.jsonPath);
    if (subValue !== undefined && subValue !== null && subValue !== '') {
      parts.push(String(subValue));
    }
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

function applyFieldConfig(metadata, configJson) {
  if (!Array.isArray(configJson) || configJson.length === 0) {
    return metadata;
  }

  const configByKey = new Map(configJson.map(field => [field.key, field]));
  const extracted = {};

  for (const field of configJson) {
    if (!field?.isEnabled) continue;

    let value;
    if (field.isCombined) {
      value = resolveCombinedValue(metadata, field, configByKey);
    } else if (field.jsonPath) {
      value = getNestedValue(metadata, field.jsonPath);
    }

    if (value !== undefined && value !== null && value !== '' && field.valueMap && typeof field.valueMap === 'object') {
      value = applyValueMap(value, field.valueMap);
    }

    if (value !== undefined && value !== null && value !== '') {
      extracted[field.key] = value;
    }
  }

  return { ...metadata, ...extracted };
}

export async function parseMetadata(filePath, configJson) {
  try {
    const et = getExifTool();
    const rawMetadata = await et.read(filePath);
    
    if (!configJson) {
      try {
        const db = await getDb();
        configJson = await db.getMetadataFields();
      } catch (e) {
        console.log('[parseMetadata] No config found, using raw metadata');
      }
    }

    return applyFieldConfig(rawMetadata, configJson);
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
