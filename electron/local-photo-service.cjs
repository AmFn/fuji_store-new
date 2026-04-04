const path = require('node:path');
const { stat, readdir } = require('node:fs/promises');
const crypto = require('node:crypto');
const chokidar = require('chokidar');
const { Worker } = require('node:worker_threads');
const { shell } = require('electron');
const { PhotoDatabase } = require('../database/photo-db.cjs');

class TaskQueue {
  constructor(concurrency = 4) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.#next();
    });
  }

  async onIdle() {
    if (this.running === 0 && this.queue.length === 0) return;
    await new Promise((resolve) => {
      const check = () => {
        if (this.running === 0 && this.queue.length === 0) {
          resolve();
          return;
        }
        setTimeout(check, 40);
      };
      check();
    });
  }

  #next() {
    if (this.running >= this.concurrency) return;
    const item = this.queue.shift();
    if (!item) return;

    this.running += 1;
    Promise.resolve()
      .then(() => item.task())
      .then(item.resolve)
      .catch(item.reject)
      .finally(() => {
        this.running -= 1;
        this.#next();
      });
  }
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']);

function isImageFile(filePath) {
  return IMAGE_EXTS.has(path.extname(filePath).toLowerCase());
}

function buildHash(filePath, fileStat) {
  return crypto.createHash('sha1').update(`${filePath}:${fileStat.size}:${fileStat.mtimeMs}`).digest('hex');
}

async function scanRecursive(rootFolder, onFile) {
  const stack = [rootFolder];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile() && isImageFile(full)) {
        await onFile(full);
      }
    }
  }
}

class LocalPhotoService {
  constructor({ dbPath, thumbnailCacheDir, onLibraryUpdated }) {
    this.db = new PhotoDatabase(dbPath);
    this.thumbnailCacheDir = thumbnailCacheDir;
    this.onLibraryUpdated = onLibraryUpdated;
    this.ingestQueue = new TaskQueue(12);
    this.thumbQueue = new TaskQueue(4);
    this.inflightByHash = new Map();
    this.watchers = new Map();
  }

  async generateThumbs(filePath, hash) {
    if (this.inflightByHash.has(hash)) return this.inflightByHash.get(hash);

    const task = this.thumbQueue.add(
      () =>
        new Promise((resolve, reject) => {
          const worker = new Worker(path.join(process.cwd(), 'workers', 'thumbnail-worker.js'), {
            workerData: {
              sourcePath: filePath,
              hash,
              cacheDir: this.thumbnailCacheDir,
              sizes: [200, 800],
            },
          });
          worker.on('message', (msg) => (msg.ok ? resolve(msg) : reject(new Error(msg.message))));
          worker.on('error', reject);
          worker.on('exit', (code) => {
            if (code !== 0) reject(new Error(`worker exit ${code}`));
          });
        }),
    );

    this.inflightByHash.set(hash, task);
    try {
      return await task;
    } finally {
      this.inflightByHash.delete(hash);
    }
  }

  async upsertPhoto(filePath) {
    if (!isImageFile(filePath)) return;
    const fileStat = await stat(filePath);
    const hash = buildHash(filePath, fileStat);
    const old = this.db.getPhotoByPath(filePath);
    if (old?.hash === hash) return;

    const thumbs = await this.generateThumbs(filePath, hash);

    this.db.upsertPhoto({
      path: filePath,
      hash,
      width: thumbs.width,
      height: thumbs.height,
      created_at: Math.floor(fileStat.birthtimeMs || fileStat.ctimeMs || fileStat.mtimeMs),
      mtime_ms: Math.floor(fileStat.mtimeMs),
      size_bytes: fileStat.size,
      thumbnail_path_200: thumbs.thumbnails[200],
      thumbnail_path_800: thumbs.thumbnails[800],
      updated_at: Date.now(),
    });

    this.#notify({ type: 'photo_upserted', path: filePath });
  }

  async scanFolder(folderPath, watch = true) {
    let scanned = 0;
    let failures = 0;

    await scanRecursive(folderPath, async (filePath) => {
      scanned += 1;
      this.ingestQueue.add(async () => {
        try {
          await this.upsertPhoto(filePath);
        } catch {
          failures += 1;
        }
      });
    });

    await this.ingestQueue.onIdle();
    if (watch) this.startWatching(folderPath);

    this.#notify({ type: 'scan_completed', scanned, failures, folderPath });
    return { scanned, failures, folderPath };
  }

  startWatching(folderPath) {
    if (this.watchers.has(folderPath)) return;

    const watcher = chokidar.watch(folderPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
      depth: 99,
    });

    watcher.on('add', (filePath) => {
      if (!isImageFile(filePath)) return;
      this.ingestQueue.add(() => this.upsertPhoto(filePath));
    });

    watcher.on('change', (filePath) => {
      if (!isImageFile(filePath)) return;
      this.ingestQueue.add(() => this.upsertPhoto(filePath));
    });

    watcher.on('unlink', (filePath) => {
      if (!isImageFile(filePath)) return;
      this.db.deletePhotoByPath(filePath);
      this.#notify({ type: 'photo_deleted', path: filePath });
    });

    this.watchers.set(folderPath, watcher);
  }

  getWatchedFolders() {
    return Array.from(this.watchers.keys());
  }

  getPhotosPage(page = 1, pageSize = 120) {
    return this.db.getPhotosPage(page, pageSize);
  }

  getPhotoCount() {
    return this.db.countPhotos();
  }

  async updatePhotoByPath(photoPath, patch) {
    const current = this.db.getPhotoByPath(photoPath);
    if (!current) return;
    const next = { ...current, ...patch, updated_at: Date.now() };
    this.db.upsertPhoto(next);
    this.#notify({ type: 'photo_upserted', path: photoPath });
  }

  removePhoto(photoPath) {
    this.db.deletePhotoByPath(photoPath);
    this.#notify({ type: 'photo_deleted', path: photoPath });
  }

  showInFolder(photoPath) {
    shell.showItemInFolder(photoPath);
  }

  #notify(payload) {
    if (typeof this.onLibraryUpdated === 'function') this.onLibraryUpdated(payload);
  }
}

module.exports = { LocalPhotoService };
