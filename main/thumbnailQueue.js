import fsp from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { EventEmitter } from 'node:events';
import PQueue from 'p-queue';

const TASK_STATUS = {
  pending: 'pending',
  processing: 'processing',
  done: 'done',
  error: 'error',
};

async function exists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export class ThumbnailQueue extends EventEmitter {
  constructor({
    db,
    cacheDir = path.join(process.cwd(), 'cache', 'thumbnails'),
    concurrency = 4,
    retry = 2,
    quality = 82,
    maxEdge = 480,
    timeoutMs = 30000,
  } = {}) {
    super();
    if (!db) throw new Error('ThumbnailQueue requires db');

    this.db = db;
    this.cacheDir = cacheDir;
    this.retry = retry;
    this.quality = quality;
    this.maxEdge = maxEdge;
    this.timeoutMs = timeoutMs;
    this.queue = new PQueue({ concurrency });
    this.tasks = new Map(); // hash -> task
    this.inflight = new Map(); // hash -> promise
  }

  async init() {
    await fsp.mkdir(this.cacheDir, { recursive: true });
  }

  thumbnailPath(hash) {
    return path.join(this.cacheDir, `${hash}.jpg`);
  }

  getStatus(hash) {
    if (hash) return this.tasks.get(hash) ?? null;
    return {
      queueSize: this.queue.size,
      queuePending: this.queue.pending,
      inflight: this.inflight.size,
    };
  }

  async ensureForPhoto(photo) {
    const thumbPath = this.thumbnailPath(photo.hash);
    if (await exists(thumbPath)) {
      if (photo.path) await this.db.updateThumbnailStatus(photo.path, TASK_STATUS.done);
      return { status: TASK_STATUS.done, thumbnailPath: thumbPath, skipped: true };
    }
    return this.enqueue(photo.path, photo.hash, { reason: 'lazy-access' });
  }

  async enqueue(photoPath, hash, { reason = 'manual' } = {}) {
    if (!photoPath || !hash) {
      throw new Error('enqueue requires photoPath and hash');
    }

    const outputPath = this.thumbnailPath(hash);
    if (await exists(outputPath)) {
      await this.db.updateThumbnailStatus(photoPath, TASK_STATUS.done);
      return { status: TASK_STATUS.done, thumbnailPath: outputPath, skipped: true };
    }

    if (this.inflight.has(hash)) {
      return this.inflight.get(hash);
    }

    const task = {
      hash,
      photoPath,
      outputPath,
      status: TASK_STATUS.pending,
      attempts: 0,
      reason,
      error: null,
      updatedAt: Date.now(),
    };
    this.tasks.set(hash, task);
    await this.db.updateThumbnailStatus(photoPath, TASK_STATUS.pending);

    const promise = this.queue.add(async () => this.#runTask(task));
    this.inflight.set(hash, promise);

    promise.finally(() => {
      this.inflight.delete(hash);
    });
    return promise;
  }

  async #runTask(task) {
    task.status = TASK_STATUS.processing;
    task.updatedAt = Date.now();
    await this.db.updateThumbnailStatus(task.photoPath, TASK_STATUS.processing);
    this.emit('task:start', { hash: task.hash, path: task.photoPath });

    while (task.attempts <= this.retry) {
      task.attempts += 1;
      try {
        const result = await this.#runWorker(task.photoPath, task.outputPath);
        task.status = TASK_STATUS.done;
        task.updatedAt = Date.now();
        await this.db.updateThumbnailStatus(task.photoPath, TASK_STATUS.done);

        if (result.width > 0 && result.height > 0) {
          await this.db.updatePhotoByPath(task.photoPath, {
            width: result.width,
            height: result.height,
            updated_at: Date.now(),
          });
        }

        const payload = { hash: task.hash, thumbnailPath: task.outputPath, ...result };
        this.emit('task:done', payload);
        return payload;
      } catch (error) {
        task.error = error.message;
        task.updatedAt = Date.now();
        if (task.attempts > this.retry) {
          task.status = TASK_STATUS.error;
          await this.db.updateThumbnailStatus(task.photoPath, TASK_STATUS.error);
          this.emit('task:error', { hash: task.hash, path: task.photoPath, error: error.message });
          throw error;
        }
        this.emit('task:retry', {
          hash: task.hash,
          path: task.photoPath,
          attempt: task.attempts,
          error: error.message,
        });
      }
    }
    throw new Error('Unexpected task loop exit');
  }

  async #runWorker(sourcePath, outputPath) {
    const workerUrl = new URL('../workers/imageWorker.js', import.meta.url);
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerUrl, {
        type: 'module',
        workerData: {
          sourcePath,
          outputPath,
          maxEdge: this.maxEdge,
          quality: this.quality,
        },
      });

      const timeout = setTimeout(() => {
        worker.terminate().catch(() => undefined);
        reject(new Error(`Thumbnail worker timeout: ${sourcePath}`));
      }, this.timeoutMs);

      worker.once('message', (msg) => {
        clearTimeout(timeout);
        if (msg?.ok) resolve(msg);
        else reject(new Error(msg?.error || 'Thumbnail worker failed'));
      });
      worker.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      worker.once('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Thumbnail worker exited with code ${code}`));
        }
      });
    });
  }

  async onIdle() {
    await this.queue.onIdle();
  }

  clear() {
    this.queue.clear();
  }
}

export { TASK_STATUS };
