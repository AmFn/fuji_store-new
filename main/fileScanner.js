import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalizePath } from './db.js';

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.raf']);

function isImageFile(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
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

async function* walkDirectory(rootDir, { recursive = true, signal } = {}) {
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

      if (entry.isFile() && isImageFile(fullPath)) {
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

  async #buildRecord(filePath) {
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

    return {
      path: normalized,
      hash,
      size: stats.size,
      width: 0,
      height: 0,
      created_at: Math.floor(stats.birthtimeMs || stats.ctimeMs || stats.mtimeMs),
      updated_at: Math.floor(stats.mtimeMs),
      thumbnail_status: 'pending',
      deleted: 0,
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
    } = options;

    const normalizedRoot = normalizePath(rootPath);
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
      for await (const event of walkDirectory(normalizedRoot, { recursive, signal })) {
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
            if (
              existing &&
              existing.deleted === 0 &&
              Number(existing.size) === Number(stats.size) &&
              Number(existing.updated_at) === Math.floor(stats.mtimeMs)
            ) {
              this.progress.skipped += 1;
              continue;
            }
          }

          const record = await this.#buildRecord(normalizedPath);
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
}

export {
  SUPPORTED_EXTENSIONS,
  isImageFile,
  walkDirectory,
  hashFileContent,
  quickFileHash,
};
