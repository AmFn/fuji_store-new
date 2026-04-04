import chokidar from 'chokidar';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { isImageFile, quickFileHash, walkDirectory } from './fileScanner.js';
import { normalizePath } from './db.js';

function isPathInRoot(filePath, roots) {
  for (const root of roots) {
    if (filePath === root || filePath.startsWith(`${root}/`)) {
      return true;
    }
  }
  return false;
}

async function buildRecordFromDisk(filePath) {
  const stats = await fsp.stat(filePath);
  return {
    path: normalizePath(filePath),
    hash: quickFileHash(normalizePath(filePath), stats),
    size: stats.size,
    width: 0,
    height: 0,
    created_at: Math.floor(stats.birthtimeMs || stats.ctimeMs || stats.mtimeMs),
    updated_at: Math.floor(stats.mtimeMs),
    thumbnail_status: 'pending',
    deleted: 0,
  };
}

export class FileWatcher extends EventEmitter {
  constructor({
    db,
    thumbnailQueue,
    debounceMs = 250,
    dedupeWindowMs = 1200,
    flushIntervalMs = 600,
    batchSize = 200,
  }) {
    super();
    if (!db) throw new Error('FileWatcher requires db');
    if (!thumbnailQueue) throw new Error('FileWatcher requires thumbnailQueue');

    this.db = db;
    this.thumbnailQueue = thumbnailQueue;
    this.debounceMs = debounceMs;
    this.dedupeWindowMs = dedupeWindowMs;
    this.flushIntervalMs = flushIntervalMs;
    this.batchSize = batchSize;

    this.watchers = new Map();
    this.watchedRoots = new Set();
    this.pending = new Map(); // path => {type,path,at}
    this.lastEvent = new Map(); // key(type:path) => ts
    this.flushTimer = null;
    this.flushing = false;
  }

  getWatchedDirectories() {
    return [...this.watchedRoots];
  }

  async watchDirectory(dirPath) {
    const root = normalizePath(dirPath);
    if (this.watchers.has(root)) return false;

    const watcher = chokidar.watch(root, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: this.debounceMs, pollInterval: 100 },
      ignored: (targetPath, stats) => {
        if (stats?.isFile() && !isImageFile(targetPath)) return true;
        const name = path.basename(targetPath);
        return name.startsWith('.') || name === 'Thumbs.db';
      },
    });

    watcher.on('add', (filePath) => this.#enqueue('add', filePath));
    watcher.on('change', (filePath) => this.#enqueue('change', filePath));
    watcher.on('unlink', (filePath) => this.#enqueue('unlink', filePath));
    watcher.on('error', (error) => this.emit('error', { root, error }));
    watcher.on('ready', () => this.emit('ready', { root }));

    this.watchers.set(root, watcher);
    this.watchedRoots.add(root);
    return true;
  }

  async unwatchDirectory(dirPath) {
    const root = normalizePath(dirPath);
    const watcher = this.watchers.get(root);
    if (!watcher) return false;

    await watcher.close();
    this.watchers.delete(root);
    this.watchedRoots.delete(root);
    return true;
  }

  async stopAll() {
    const watchers = [...this.watchers.values()];
    this.watchers.clear();
    this.watchedRoots.clear();

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    await Promise.allSettled(watchers.map((w) => w.close()));
    await this.#flushPending();
  }

  #enqueue(type, rawPath) {
    const filePath = normalizePath(rawPath);
    if (!isImageFile(filePath)) return;

    const dedupeKey = `${type}:${filePath}`;
    const now = Date.now();
    const lastTs = this.lastEvent.get(dedupeKey) ?? 0;
    if (now - lastTs < this.dedupeWindowMs) return;
    this.lastEvent.set(dedupeKey, now);

    const prev = this.pending.get(filePath);
    const finalType = this.#mergeEventType(prev?.type, type);
    this.pending.set(filePath, { type: finalType, path: filePath, at: now });

    if (this.pending.size >= this.batchSize) {
      void this.#flushPending();
      return;
    }
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.#flushPending();
      }, this.flushIntervalMs);
    }
  }

  #mergeEventType(prev, next) {
    if (!prev) return next;
    if (next === 'unlink') return 'unlink';
    if (prev === 'unlink' && next === 'add') return 'change';
    if (prev === 'add' && next === 'change') return 'add';
    return next;
  }

  async #flushPending() {
    if (this.flushing || this.pending.size === 0) return;
    this.flushing = true;
    const events = [...this.pending.values()];
    this.pending.clear();

    const addOrChange = [];
    const unlinkPaths = [];
    for (const item of events) {
      if (item.type === 'unlink') unlinkPaths.push(item.path);
      else addOrChange.push(item.path);
    }

    try {
      if (unlinkPaths.length > 0) {
        const count = await this.db.markPhotosDeleted(unlinkPaths);
        this.emit('batch:unlink', { count, paths: unlinkPaths });
      }

      if (addOrChange.length > 0) {
        const rows = await this.#prepareUpsertRows(addOrChange);
        if (rows.length > 0) {
          await this.db.upsertPhotosBatch(rows);
          for (const row of rows) {
            await this.thumbnailQueue.enqueue(row.path, row.hash, { reason: 'watcher' });
          }
        }
        this.emit('batch:upsert', { count: rows.length, paths: addOrChange });
      }
    } catch (error) {
      this.emit('error', { error });
    } finally {
      this.flushing = false;
    }
  }

  async #prepareUpsertRows(paths) {
    const records = [];
    for (const filePath of paths) {
      try {
        const row = await buildRecordFromDisk(filePath);
        const existing = await this.db.getPhotoByPath(filePath);
        if (
          existing &&
          existing.deleted === 0 &&
          Number(existing.size) === Number(row.size) &&
          Number(existing.updated_at) === Number(row.updated_at)
        ) {
          continue;
        }
        records.push(row);
      } catch {
        // file may have disappeared between events
      }
    }
    return records;
  }

  async resyncLibrary({ directories = this.getWatchedDirectories(), onProgress } = {}) {
    const normalizedRoots = directories.map(normalizePath);
    const dbActivePaths = await this.db.getAllActivePaths();
    const dbActiveSet = new Set(dbActivePaths);
    const seenOnDisk = new Set();

    let scanned = 0;
    let inserted = 0;
    let deleted = 0;
    let failed = 0;
    const pendingInsert = [];
    const markDeletedBuffer = [];

    const flushInsert = async () => {
      if (pendingInsert.length === 0) return;
      const rows = pendingInsert.splice(0, pendingInsert.length);
      inserted += await this.db.upsertPhotosBatch(rows);
      for (const row of rows) {
        await this.thumbnailQueue.enqueue(row.path, row.hash, { reason: 'resync' });
      }
    };

    for (const root of normalizedRoots) {
      for await (const event of walkDirectory(root, { recursive: true })) {
        if (event.type !== 'file') continue;
        const filePath = normalizePath(event.path);
        seenOnDisk.add(filePath);
        scanned += 1;
        try {
          if (!dbActiveSet.has(filePath)) {
            pendingInsert.push(await buildRecordFromDisk(filePath));
            if (pendingInsert.length >= this.batchSize) {
              await flushInsert();
            }
          }
        } catch {
          failed += 1;
        }
        if (scanned % this.batchSize === 0 && onProgress) {
          await onProgress({ scanned, inserted, deleted, failed });
        }
      }
    }

    await flushInsert();

    for (const dbPath of dbActiveSet) {
      if (!isPathInRoot(dbPath, normalizedRoots)) continue;
      if (!seenOnDisk.has(dbPath)) {
        markDeletedBuffer.push(dbPath);
        if (markDeletedBuffer.length >= this.batchSize) {
          deleted += await this.db.markPhotosDeleted(markDeletedBuffer.splice(0, markDeletedBuffer.length));
        }
      }
    }
    if (markDeletedBuffer.length > 0) {
      deleted += await this.db.markPhotosDeleted(markDeletedBuffer);
    }

    const result = { scanned, inserted, deleted, failed };
    if (onProgress) await onProgress(result);
    this.emit('resync:done', result);
    return result;
  }
}

