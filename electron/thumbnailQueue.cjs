/**
 * 缩略图任务队列模块 - 使用 p-queue + Worker Threads
 * 功能：并发控制、任务状态管理、失败重试、缩略图懒生成
 */

const { default: PQueue } = require('p-queue');
const { Worker } = require('node:worker_threads');
const path = require('node:path');
const fs = require('node:fs/promises');
const { EventEmitter } = require('node:events');

// 队列配置
const QUEUE_CONFIG = {
  CONCURRENCY: 4,           // 并发 worker 数
  RETRY_ATTEMPTS: 3,        // 失败重试次数
  RETRY_DELAY: 1000,        // 重试延迟(ms)
  BATCH_SIZE: 10,           // 批量处理大小
  TIMEOUT: 30000,           // 单个任务超时(ms)
};

// 缩略图配置
const THUMBNAIL_CONFIG = {
  SIZES: [200, 800, 1920],   // 生成的缩略图尺寸：缩略图、预览图、大图预览
  QUALITY: 82,              // WebP 质量
  FORMAT: 'webp',           // 输出格式
  EFFORT: 4,                // 压缩 effort (0-6)
};

/**
 * 检查文件是否存在
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 任务状态枚举
 */
const TaskStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
  RETRYING: 'retrying',
};

/**
 * 缩略图任务
 */
class ThumbnailTask {
  constructor(photoPath, hash, options = {}) {
    this.id = `${hash}_${Date.now()}`;
    this.photoPath = photoPath;
    this.hash = hash;
    this.status = TaskStatus.PENDING;
    this.attempts = 0;
    this.maxAttempts = options.maxAttempts || QUEUE_CONFIG.RETRY_ATTEMPTS;
    this.error = null;
    this.result = null;
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
    this.priority = options.priority || 0;
  }

  /**
   * 开始处理
   */
  start() {
    this.status = TaskStatus.PROCESSING;
    this.startedAt = Date.now();
    this.attempts++;
  }

  /**
   * 完成处理
   */
  complete(result) {
    this.status = TaskStatus.DONE;
    this.result = result;
    this.completedAt = Date.now();
    this.error = null;
  }

  /**
   * 标记失败
   */
  fail(error) {
    this.error = error;
    if (this.attempts < this.maxAttempts) {
      this.status = TaskStatus.RETRYING;
    } else {
      this.status = TaskStatus.ERROR;
      this.completedAt = Date.now();
    }
  }

  /**
   * 是否可以重试
   */
  canRetry() {
    return this.attempts < this.maxAttempts && this.status !== TaskStatus.DONE;
  }

  /**
   * 获取处理时长
   */
  getDuration() {
    if (!this.startedAt) return 0;
    const end = this.completedAt || Date.now();
    return end - this.startedAt;
  }
}

/**
 * 缩略图队列管理器
 */
class ThumbnailQueue extends EventEmitter {
  constructor(options = {}) {
    super();

    this.cacheDir = options.cacheDir || path.join(process.cwd(), 'cache', 'thumbnails');
    this.concurrency = options.concurrency || QUEUE_CONFIG.CONCURRENCY;
    this.database = options.database || null;

    // 创建队列
    this.queue = new PQueue({
      concurrency: this.concurrency,
      timeout: QUEUE_CONFIG.TIMEOUT,
      throwOnTimeout: true,
    });

    // 任务管理
    this.tasks = new Map();           // taskId -> ThumbnailTask
    this.inflight = new Map();        // hash -> Promise (防止重复处理)
    this.completed = new Map();       // hash -> result (缓存结果)

    // 统计
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      retried: 0,
    };

    // 确保缓存目录存在
    this._ensureCacheDir();

    // 绑定队列事件
    this.queue.on('completed', (result) => {
      this.emit('task:completed', result);
    });

    this.queue.on('failed', (error) => {
      this.emit('task:failed', error);
    });
  }

  /**
   * 确保缓存目录存在
   */
  async _ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (err) {
      console.error('[ThumbnailQueue] Failed to create cache directory:', err);
    }
  }

  /**
   * 添加任务到队列
   * @param {string} photoPath - 原图路径
   * @param {string} hash - 文件 hash
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 缩略图结果
   */
  async add(photoPath, hash, options = {}) {
    // 检查是否已在处理中
    if (this.inflight.has(hash)) {
      return this.inflight.get(hash);
    }

    // 检查是否已完成
    if (this.completed.has(hash)) {
      return this.completed.get(hash);
    }

    // 检查缩略图是否已存在
    const existingThumbs = await this._checkExistingThumbnails(hash);
    if (existingThumbs) {
      // 更新数据库状态为 done
      if (this.database) {
        this.database.updateThumbnailStatus(photoPath, 'done');
      }
      this.completed.set(hash, existingThumbs);
      return existingThumbs;
    }

    // 创建任务
    const task = new ThumbnailTask(photoPath, hash, options);
    this.tasks.set(task.id, task);
    this.stats.total++;

    // 创建处理 Promise
    const promise = this._processTask(task);
    this.inflight.set(hash, promise);

    // 清理 inflight
    promise
      .then((result) => {
        this.completed.set(hash, result);
      })
      .catch(() => {
        // 失败不缓存，允许重试
      })
      .finally(() => {
        this.inflight.delete(hash);
      });

    return promise;
  }

  /**
   * 批量添加任务
   */
  async addBatch(items, options = {}) {
    const promises = items.map((item, index) => {
      const priority = options.priority || 0;
      return this.add(item.path, item.hash, { ...options, priority: priority - index });
    });

    return Promise.allSettled(promises);
  }

  /**
   * 处理单个任务
   */
  async _processTask(task) {
    return this.queue.add(async () => {
      task.start();
      this.emit('task:started', { id: task.id, path: task.photoPath });

      try {
        const result = await this._generateThumbnails(task);
        task.complete(result);
        this.stats.completed++;

        // 更新数据库状态
        if (this.database) {
          this.database.updateThumbnailStatus(task.photoPath, 'done');
        }

        this.emit('task:success', {
          id: task.id,
          path: task.photoPath,
          duration: task.getDuration(),
          result,
        });

        return result;
      } catch (error) {
        task.fail(error.message);

        if (task.canRetry()) {
          this.stats.retried++;
          this.emit('task:retry', {
            id: task.id,
            path: task.photoPath,
            attempt: task.attempts,
            error: error.message,
          });

          // 延迟重试
          await this._delay(QUEUE_CONFIG.RETRY_DELAY * task.attempts);
          return this._processTask(task);
        } else {
          this.stats.failed++;

          // 更新数据库状态
          if (this.database) {
            this.database.updateThumbnailStatus(task.photoPath, 'error');
          }

          this.emit('task:error', {
            id: task.id,
            path: task.photoPath,
            attempts: task.attempts,
            error: error.message,
          });

          throw error;
        }
      }
    }, { priority: task.priority });
  }

  /**
   * 生成缩略图（使用 Worker Thread）
   */
  async _generateThumbnails(task) {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(process.cwd(), 'workers', 'imageWorker.cjs');
      
      console.log(`[ThumbnailQueue] Starting worker for: ${task.photoPath}`);

      const worker = new Worker(workerPath, {
        workerData: {
          task: 'thumbnail',
          sourcePath: task.photoPath,
          hash: task.hash,
          cacheDir: this.cacheDir,
          sizes: THUMBNAIL_CONFIG.SIZES,
          quality: THUMBNAIL_CONFIG.QUALITY,
          format: THUMBNAIL_CONFIG.FORMAT,
          effort: THUMBNAIL_CONFIG.EFFORT,
        },
      });

      const timeout = setTimeout(() => {
        worker.terminate();
        console.error(`[ThumbnailQueue] Worker timeout for: ${task.photoPath}`);
        reject(new Error(`Worker timeout after ${QUEUE_CONFIG.TIMEOUT}ms`));
      }, QUEUE_CONFIG.TIMEOUT);

      worker.on('message', (msg) => {
        clearTimeout(timeout);
        if (msg.ok) {
          console.log(`[ThumbnailQueue] Worker success for: ${task.photoPath}`);
          resolve(msg);
        } else {
          console.error(`[ThumbnailQueue] Worker error for ${task.photoPath}:`, msg.error);
          reject(new Error(msg.error || 'Worker error'));
        }
      });

      worker.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`[ThumbnailQueue] Worker process error for ${task.photoPath}:`, err.message);
        reject(err);
      });

      worker.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          console.error(`[ThumbnailQueue] Worker exited with code ${code} for: ${task.photoPath}`);
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
    });
  }

  /**
   * 检查缩略图是否已存在
   */
  async _checkExistingThumbnails(hash) {
    const thumbnails = {};
    let allExist = true;
    let width = 0;
    let height = 0;

    for (const size of THUMBNAIL_CONFIG.SIZES) {
      const thumbPath = path.join(this.cacheDir, `${hash}_${size}.${THUMBNAIL_CONFIG.FORMAT}`);
      if (await fileExists(thumbPath)) {
        thumbnails[size] = thumbPath;
      } else {
        allExist = false;
        break;
      }
    }

    return allExist ? { width, height, thumbnails } : null;
  }

  /**
   * 延迟函数
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      pending: this.queue.pending,
      size: this.queue.size,
      isPaused: this.queue.isPaused,
      inflight: this.inflight.size,
      completed: this.completed.size,
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 获取任务详情
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  /**
   * 暂停队列
   */
  pause() {
    this.queue.pause();
    this.emit('paused');
  }

  /**
   * 恢复队列
   */
  resume() {
    this.queue.start();
    this.emit('resumed');
  }

  /**
   * 清空队列
   */
  clear() {
    this.queue.clear();
    this.inflight.clear();
    this.emit('cleared');
  }

  /**
   * 等待队列完成
   */
  async onIdle() {
    await this.queue.onIdle();
  }

  /**
   * 根据 hash 移除任务并清理缓存
   * @param {string} hash - 照片哈希值
   */
  removeByHash(hash) {
    console.log(`[ThumbnailQueue] Removing tasks for hash: ${hash}`);
    
    // 移除队列中的任务
    const tasksToRemove = [];
    for (const [taskId, task] of this.tasks) {
      if (task.hash === hash) {
        tasksToRemove.push(taskId);
      }
    }
    
    tasksToRemove.forEach(taskId => {
      this.tasks.delete(taskId);
    });
    
    // 清理缓存文件
    if (hash) {
      const fs = require('fs');
      const path = require('path');
      
      // 尝试删除不同尺寸的缩略图
      const sizes = [200, 800, 1200];
      sizes.forEach(size => {
        const thumbnailPath = path.join(this.cacheDir, `${hash}_${size}.webp`);
        if (fs.existsSync(thumbnailPath)) {
          try {
            fs.unlinkSync(thumbnailPath);
            console.log(`[ThumbnailQueue] Deleted thumbnail: ${thumbnailPath}`);
          } catch (error) {
            console.error(`[ThumbnailQueue] Failed to delete thumbnail: ${thumbnailPath}`, error);
          }
        }
      });
    }
  }

  /**
   * 处理数据库中所有待处理的缩略图
   */
  async processPendingFromDB(limit = 100) {
    if (!this.database) {
      console.warn('[ThumbnailQueue] No database provided');
      return;
    }

    const pending = this.database.getPendingThumbnails(limit);
    console.log(`[ThumbnailQueue] Processing ${pending.length} pending thumbnails from DB`);

    const results = await this.addBatch(pending);

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[ThumbnailQueue] Batch complete: ${succeeded} succeeded, ${failed} failed`);

    return { succeeded, failed, total: pending.length };
  }

  /**
   * 清理过期的缩略图缓存
   */
  async cleanupCache(maxAgeDays = 30) {
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let deleted = 0;

    try {
      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          deleted++;
        }
      }

      console.log(`[ThumbnailQueue] Cleaned up ${deleted} old thumbnails`);
      return deleted;
    } catch (err) {
      console.error('[ThumbnailQueue] Cleanup error:', err);
      return 0;
    }
  }
}

module.exports = {
  ThumbnailQueue,
  ThumbnailTask,
  TaskStatus,
  QUEUE_CONFIG,
  THUMBNAIL_CONFIG,
};
