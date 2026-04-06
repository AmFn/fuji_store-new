import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ExifTool } from 'exiftool-vendored';
import { normalizePath, getDb } from './db.js';

import exifr from 'exifr';

let scannerExiftool = null;

function getScannerExiftool() {
  if (!scannerExiftool) {
    scannerExiftool = new ExifTool({ taskTimeoutMillis: 10000 });
  }
  return scannerExiftool;
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

function serializeMetadataSafe(metadata) {
  try {
    return JSON.stringify(metadata, (_key, value) => {
      if (typeof value === 'bigint') return Number(value);
      if (value instanceof Date) return value.toISOString();
      if (value && typeof value === 'object') {
        if (value.rawValue !== undefined) return value.rawValue;
        if (value.value !== undefined && (typeof value.value === 'string' || typeof value.value === 'number')) {
          return value.value;
        }
      }
      return value;
    });
  } catch {
    return '{}';
  }
}

function getExifValue(metadata, keys) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (value !== undefined && value !== null && value !== '') {
      if (value && typeof value === 'object') {
        if (value.rawValue !== undefined) return value.rawValue;
        if (value.value !== undefined) return value.value;
      }
      return value;
    }
  }
  return null;
}

async function getFullMetadata(filePath, configJson) {
  try {
    const exiftool = getScannerExiftool();
    const rawMetadata = await exiftool.read(filePath);
    
    let effectiveConfig = configJson;
    if (effectiveConfig === undefined) {
      try {
        const db = await getDb();
        if (db && db.getMetadataFields) {
          effectiveConfig = await db.getMetadataFields();
        }
      } catch (e) {
        console.log('[fileScanner] Could not get metadata config:', e.message);
      }
    }
    
    return applyFieldConfig(rawMetadata, effectiveConfig);
  } catch (error) {
    console.error('[fileScanner] Error getting full metadata:', error);
    return null;
  }
}

// 添加EXIF提取功能
async function getExifDateTime(filePath) {
  try {
    const metadata = await exifr.parse(filePath, {
      datetime: true,
      gps: false,
      icc: false
    });
    if (metadata && metadata.DateTime) {
      return metadata.DateTime;
    }
    return null;
  } catch (error) {
    console.error('Error extracting EXIF:', error);
    return null;
  }
}

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.raf']);

const FORMAT_EXTENSIONS = {
  JPG: ['.jpg', '.jpeg'],
  RAF: ['.raf'],
};

function isImageFile(filePath, allowedFormats = null) {
  const ext = path.extname(filePath).toLowerCase();
  if (!allowedFormats) {
    return SUPPORTED_EXTENSIONS.has(ext);
  }
  for (const format of allowedFormats) {
    const extensions = FORMAT_EXTENSIONS[format];
    if (extensions && extensions.includes(ext)) {
      return true;
    }
  }
  return false;
}

function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function hashFileContent(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function quickFileHash(filePath, stats) {
  const sig = `${filePath}|${stats.size}|${Math.floor(stats.mtimeMs)}`;
  return crypto.createHash('sha1').update(sig).digest('hex');
}

async function* walkDirectory(rootDir, { recursive = true, signal, allowedFormats = null } = {}) {
  const stack = [rootDir];

  while (stack.length > 0) {
    if (signal?.aborted) {
      throw new Error('SCAN_ABORTED');
    }

    const currentDir = stack.pop();
    let entries;
    try {
      entries = await fsp.readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      yield { type: 'error', path: currentDir, error };
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!recursive) continue;
        if (entry.name.startsWith('.')) continue;
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && isImageFile(fullPath, allowedFormats)) {
        yield { type: 'file', path: fullPath };
      }
    }
  }
}

export class FileScanner {
  constructor({ db, batchSize = 300, idleStep = 200, hashStrategy = 'quick' }) {
    if (!db) {
      throw new Error('FileScanner requires db instance');
    }
    this.db = db;
    this.batchSize = batchSize;
    this.idleStep = idleStep;
    this.hashStrategy = hashStrategy; // quick | content
    this.running = false;
    this.progress = {
      status: 'idle',
      rootPath: null,
      scanned: 0,
      indexed: 0,
      skipped: 0,
      failed: 0,
      startedAt: null,
      finishedAt: null,
      lastError: null,
    };
    this.hashCache = new Map();
  }

  getProgress() {
    return { ...this.progress };
  }

  async #buildRecord(filePath, configJson = null) {
    const normalized = normalizePath(filePath);
    const stats = await fsp.stat(filePath);
    const signature = `${normalized}:${stats.size}:${Math.floor(stats.mtimeMs)}`;
    let hash = this.hashCache.get(signature);

    if (!hash) {
      hash = this.hashStrategy === 'content'
        ? await hashFileContent(filePath)
        : quickFileHash(normalized, stats);
      this.hashCache.set(signature, hash);
      if (this.hashCache.size > 20000) {
        this.hashCache.clear();
      }
    }

    // 尝试从EXIF中提取拍摄时间，使用 exiftool-vendored
    let created_at = Math.floor(stats.birthtimeMs || stats.ctimeMs || stats.mtimeMs);
    let shot_at = null;
    let metadata_json = '{}';
    let film_mode = null;
    let white_balance = null;
    let dynamic_range = null;
    let color_chrome = null;
    let color_chrome_blue = null;
    let grain_effect = null;
    
    try {
      const rawMetadata = await getFullMetadata(filePath, configJson);
      
      if (rawMetadata) {
        if (rawMetadata.DateTimeOriginal) {
          const dt = new Date(String(rawMetadata.DateTimeOriginal.rawValue ?? rawMetadata.DateTimeOriginal).replace(/^(\d{4}):(\d{2}):(\d{2})\s+/, '$1-$2-$3T'));
          if (!Number.isNaN(dt.getTime())) shot_at = Math.floor(dt.getTime());
        } else if (rawMetadata.CreateDate) {
          const dt = new Date(String(rawMetadata.CreateDate.rawValue ?? rawMetadata.CreateDate).replace(/^(\d{4}):(\d{2}):(\d{2})\s+/, '$1-$2-$3T'));
          if (!Number.isNaN(dt.getTime())) shot_at = Math.floor(dt.getTime());
        }
        // 存储完整元数据（安全序列化）
        metadata_json = serializeMetadataSafe(rawMetadata);
        // 兼容富士字段别名
        film_mode = getExifValue(rawMetadata, ['filmSimulation', 'filmMode', 'FilmMode', 'FujiFilm:FilmMode', 'FilmSimulation']);
        white_balance = getExifValue(rawMetadata, ['whiteBalance', 'WhiteBalance', 'FujiFilm:WhiteBalance']);
        dynamic_range = getExifValue(rawMetadata, ['dynamicRange', 'DynamicRange', 'FujiFilm:DynamicRange', 'DynamicRangeSetting']);
        color_chrome = getExifValue(rawMetadata, ['ColorChromeEffect', 'FujiFilm:ColorChromeEffect']);
        color_chrome_blue = getExifValue(rawMetadata, ['ColorChromeEffectBlue', 'FujiFilm:ColorChromeEffectBlue']);
        grain_effect = getExifValue(rawMetadata, ['GrainEffect', 'FujiFilm:GrainEffect']);
      }
    } catch (e) {
      console.log('[fileScanner] Error extracting metadata:', e.message);
    }
    
    return {
      path: normalized,
      hash,
      size: stats.size,
      width: 0,
      height: 0,
      created_at,
      shot_at,
      updated_at: Math.floor(stats.mtimeMs),
      thumbnail_status: 'pending',
      deleted: 0,
      metadata_json,
      film_mode: film_mode ? String(film_mode) : null,
      white_balance: white_balance ? String(white_balance) : null,
      dynamic_range: dynamic_range ? String(dynamic_range) : null,
      color_chrome: color_chrome ? String(color_chrome) : null,
      color_chrome_blue: color_chrome_blue ? String(color_chrome_blue) : null,
      grain_effect: grain_effect ? String(grain_effect) : null,
    };
  }

  async #flushBatch(batch, onBatchIndexed) {
    if (batch.length === 0) return 0;
    const rows = [...batch];
    const written = await this.db.upsertPhotosBatch(rows);
    if (onBatchIndexed) {
      await onBatchIndexed(rows);
    }
    batch.length = 0;
    return written;
  }

  async scanDirectory(rootPath, options = {}) {
    if (this.running) {
      throw new Error('Scan already in progress');
    }

    const {
      recursive = true,
      signal,
      onProgress,
      onBatchIndexed,
      skipUnchanged = true,
      allowedFormats = null,
    } = options;

    const normalizedRoot = normalizePath(rootPath);
    let metadataConfig = null;
    try {
      metadataConfig = await this.db.getMetadataFields();
    } catch (error) {
      console.warn('[fileScanner] Failed to load metadata config, fallback to raw EXIF:', error?.message || error);
    }
    const batch = [];
    const seenPaths = new Set();
    let scannedSinceYield = 0;

    this.running = true;
    this.progress = {
      status: 'running',
      rootPath: normalizedRoot,
      scanned: 0,
      indexed: 0,
      skipped: 0,
      failed: 0,
      startedAt: Date.now(),
      finishedAt: null,
      lastError: null,
    };

    try {
      for await (const event of walkDirectory(normalizedRoot, { recursive, signal, allowedFormats })) {
        if (event.type === 'error') {
          this.progress.failed += 1;
          this.progress.lastError = `${event.path}: ${event.error.message}`;
          if (onProgress) await onProgress(this.getProgress());
          continue;
        }

        const normalizedPath = normalizePath(event.path);
        if (seenPaths.has(normalizedPath)) {
          this.progress.skipped += 1;
          continue;
        }
        seenPaths.add(normalizedPath);
        this.progress.scanned += 1;

        try {
          // Skip unchanged files early to reduce hash + DB write pressure in large libraries.
          if (skipUnchanged) {
            const stats = await fsp.stat(normalizedPath);
            const existing = await this.db.getPhotoByPath(normalizedPath);
            const metadataMissing = existing && (
              !existing.metadata_json ||
              existing.metadata_json === '{}' ||
              existing.metadata_json === 'null' ||
              (!existing.film_mode && !existing.white_balance && !existing.dynamic_range)
            );
            if (
              existing &&
              existing.deleted === 0 &&
              Number(existing.size) === Number(stats.size) &&
              Number(existing.updated_at) === Math.floor(stats.mtimeMs) &&
              !metadataMissing
            ) {
              this.progress.skipped += 1;
              continue;
            }
            // 如果文件被软删除，允许继续走构建记录并 upsert，以便导入时恢复显示
          }

          const record = await this.#buildRecord(normalizedPath, metadataConfig);
          batch.push(record);
        } catch (error) {
          this.progress.failed += 1;
          this.progress.lastError = `${normalizedPath}: ${error.message}`;
          continue;
        }

        if (batch.length >= this.batchSize) {
          const inserted = await this.#flushBatch(batch, onBatchIndexed);
          this.progress.indexed += inserted;
          if (onProgress) await onProgress(this.getProgress());
        }

        scannedSinceYield += 1;
        if (scannedSinceYield >= this.idleStep) {
          scannedSinceYield = 0;
          await yieldToEventLoop();
        }
      }

      const inserted = await this.#flushBatch(batch, onBatchIndexed);
      this.progress.indexed += inserted;
      this.progress.status = 'done';
      this.progress.finishedAt = Date.now();
      if (onProgress) await onProgress(this.getProgress());

      return {
        ...this.getProgress(),
        durationMs: this.progress.finishedAt - this.progress.startedAt,
      };
    } catch (error) {
      if (error.message === 'SCAN_ABORTED') {
        this.progress.status = 'cancelled';
      } else {
        this.progress.status = 'error';
        this.progress.lastError = error.message;
      }
      this.progress.finishedAt = Date.now();
      if (onProgress) await onProgress(this.getProgress());
      throw error;
    } finally {
      this.running = false;
    }
  }

  async scanDirectoryForNewFiles(rootPath, options = {}) {
    if (this.running) {
      throw new Error('Scan already in progress');
    }

    const { recursive = true, signal } = options;
    const normalizedRoot = normalizePath(rootPath);
    let metadataConfig = null;
    try {
      metadataConfig = await this.db.getMetadataFields();
    } catch (error) {
      console.warn('[fileScanner] Failed to load metadata config, fallback to raw EXIF:', error?.message || error);
    }
    const newFiles = [];
    const seenPaths = new Set();

    this.running = true;
    this.progress = {
      status: 'running',
      rootPath: normalizedRoot,
      scanned: 0,
      indexed: 0,
      skipped: 0,
      failed: 0,
      startedAt: Date.now(),
      finishedAt: null,
      lastError: null,
    };

    try {
      for await (const event of walkDirectory(normalizedRoot, { recursive, signal })) {
        if (event.type === 'error') {
          this.progress.failed += 1;
          this.progress.lastError = `${event.path}: ${event.error.message}`;
          continue;
        }

        const normalizedPath = normalizePath(event.path);
        if (seenPaths.has(normalizedPath)) {
          this.progress.skipped += 1;
          continue;
        }
        seenPaths.add(normalizedPath);
        this.progress.scanned += 1;

        try {
          // 检查文件是否已经在数据库中且未被删除
          const stats = await fsp.stat(normalizedPath);
          const existing = await this.db.getPhotoByPath(normalizedPath);
          // 如果文件不存在，或者已被软删除，视为新文件
          if (!existing || existing.deleted === 1) {
            // 构建文件记录
            const record = await this.#buildRecord(normalizedPath, metadataConfig);
            newFiles.push({
              id: crypto.randomUUID(),
              fileName: path.basename(normalizedPath),
              path: normalizedPath,
              size: `${(record.size / (1024 * 1024)).toFixed(1)} MB`,
              date: new Date(record.created_at).toISOString().split('T')[0],
              filmMode: record.film_mode || 'Unknown'
            });
          } else {
            // 文件已存在且未被删除，跳过
            this.progress.skipped += 1;
          }
        } catch (error) {
          this.progress.failed += 1;
          this.progress.lastError = `${normalizedPath}: ${error.message}`;
          continue;
        }
      }

      this.progress.status = 'done';
      this.progress.finishedAt = Date.now();

      return {
        ...this.getProgress(),
        newFiles,
        durationMs: this.progress.finishedAt - this.progress.startedAt,
      };
    } catch (error) {
      if (error.message === 'SCAN_ABORTED') {
        this.progress.status = 'cancelled';
      } else {
        this.progress.status = 'error';
        this.progress.lastError = error.message;
      }
      this.progress.finishedAt = Date.now();
      throw error;
    } finally {
      this.running = false;
    }
  }
}

export {
  SUPPORTED_EXTENSIONS,
  isImageFile,
  walkDirectory,
  hashFileContent,
  quickFileHash,
};
