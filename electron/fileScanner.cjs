/**
 * 文件扫描模块 - 高性能目录扫描
 * 功能：递归扫描目录、过滤图片格式、分批处理、进度回调
 */

const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { Worker } = require('node:worker_threads');

// 支持的图片格式
const SUPPORTED_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif',
  '.raw', '.cr2', '.nef', '.arw', '.dng', '.raf'
]);

// 扫描配置
const SCAN_CONFIG = {
  BATCH_SIZE: 100,        // 每批处理的文件数
  BATCH_INTERVAL: 50,     // 批次间隔(ms)
  MAX_CONCURRENT_HASH: 4, // 并发计算 hash 数
};

/**
 * 检查是否为支持的图片文件
 */
function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTS.has(ext);
}

/**
 * 生成文件 hash（基于路径、大小、修改时间）
 * 用于快速检测文件是否变化
 */
function generateFileHash(filePath, stats) {
  const data = `${filePath}:${stats.size}:${stats.mtimeMs}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * 异步获取文件信息
 */
async function getFileInfo(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return {
      path: filePath,
      size: stats.size,
      created_at: Math.floor(stats.birthtimeMs || stats.ctimeMs || stats.mtimeMs),
      updated_at: Math.floor(stats.mtimeMs),
      hash: generateFileHash(filePath, stats),
    };
  } catch (err) {
    console.error(`[Scanner] Failed to stat file: ${filePath}`, err.message);
    return null;
  }
}

/**
 * 流式递归扫描目录
 * 使用栈结构避免递归深度问题
 */
async function* scanDirectoryStream(rootPath, options = {}) {
  const { recursive = true, signal } = options;
  const stack = [rootPath];
  let scanned = 0;

  while (stack.length > 0) {
    // 检查取消信号
    if (signal?.aborted) {
      throw new Error('Scan cancelled');
    }

    const currentPath = stack.pop();
    
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory() && recursive) {
          // 跳过隐藏目录和系统目录
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
          }
          stack.push(fullPath);
        } else if (entry.isFile() && isImageFile(fullPath)) {
          scanned++;
          yield { type: 'file', path: fullPath, scanned };
        }
      }
    } catch (err) {
      console.error(`[Scanner] Error reading directory: ${currentPath}`, err.message);
      yield { type: 'error', path: currentPath, error: err.message };
    }
  }

  yield { type: 'complete', scanned };
}

/**
 * 批量扫描目录
 * @param {string} rootPath - 根目录路径
 * @param {Object} options - 配置选项
 * @param {Function} onProgress - 进度回调 (progress, total, batch)
 * @param {Function} onFile - 文件回调 (fileInfo)
 * @returns {Promise<Object>} 扫描结果
 */
async function scanDirectory(rootPath, options = {}) {
  const {
    recursive = true,
    onProgress = null,
    onFile = null,
    signal = null,
    batchSize = SCAN_CONFIG.BATCH_SIZE,
  } = options;

  const startTime = Date.now();
  const result = {
    total: 0,
    scanned: 0,
    errors: [],
    files: [],
  };

  let batch = [];
  let lastProgressTime = 0;

  try {
    for await (const item of scanDirectoryStream(rootPath, { recursive, signal })) {
      switch (item.type) {
        case 'file':
          result.total++;
          
          // 收集文件信息
          const fileInfo = await getFileInfo(item.path);
          if (fileInfo) {
            batch.push(fileInfo);
            result.scanned++;

            // 单文件回调
            if (onFile) {
              await onFile(fileInfo);
            }

            // 批量处理
            if (batch.length >= batchSize) {
              result.files.push(...batch);
              
              // 进度回调（节流）
              const now = Date.now();
              if (onProgress && now - lastProgressTime > 100) {
                await onProgress({
                  scanned: result.scanned,
                  total: result.total,
                  batch: [...batch],
                  elapsed: now - startTime,
                });
                lastProgressTime = now;
              }

              batch = [];
              
              // 让出事件循环，避免阻塞
              await new Promise(resolve => setImmediate(resolve));
            }
          }
          break;

        case 'error':
          result.errors.push({ path: item.path, error: item.error });
          break;

        case 'complete':
          // 处理剩余批次
          if (batch.length > 0) {
            result.files.push(...batch);
            if (onProgress) {
              await onProgress({
                scanned: result.scanned,
                total: result.total,
                batch: [...batch],
                elapsed: Date.now() - startTime,
                completed: true,
              });
            }
          }
          break;
      }
    }
  } catch (err) {
    if (err.message === 'Scan cancelled') {
      console.log('[Scanner] Scan cancelled by user');
      result.cancelled = true;
    } else {
      throw err;
    }
  }

  result.duration = Date.now() - startTime;
  console.log(`[Scanner] Completed: ${result.scanned} files in ${result.duration}ms`);

  return result;
}

/**
 * 快速扫描（仅获取路径列表，不读取文件信息）
 * 用于预估文件数量
 */
async function quickScan(rootPath, options = {}) {
  const { recursive = true, signal } = options;
  const stack = [rootPath];
  const files = [];

  while (stack.length > 0) {
    if (signal?.aborted) break;

    const currentPath = stack.pop();
    
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory() && recursive) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
          }
          stack.push(fullPath);
        } else if (entry.isFile() && isImageFile(fullPath)) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      console.error(`[Scanner] Error: ${currentPath}`, err.message);
    }
  }

  return files;
}

/**
 * 使用 Worker Threads 并行扫描多个目录
 */
async function parallelScan(directories, options = {}) {
  const { concurrency = 2, onProgress } = options;
  
  const results = [];
  const queue = [...directories];
  const active = new Set();

  return new Promise((resolve, reject) => {
    function startNext() {
      while (active.size < concurrency && queue.length > 0) {
        const dir = queue.shift();
        const promise = scanDirectory(dir, {
          ...options,
          onProgress: (progress) => {
            onProgress?.({ directory: dir, ...progress });
          },
        });

        active.add(promise);
        
        promise
          .then(result => {
            results.push({ directory: dir, result });
          })
          .catch(err => {
            results.push({ directory: dir, error: err.message });
          })
          .finally(() => {
            active.delete(promise);
            if (queue.length === 0 && active.size === 0) {
              resolve(results);
            } else {
              startNext();
            }
          });
      }
    }

    startNext();
  });
}

/**
 * 扫描器类 - 封装扫描功能，支持状态管理
 */
class FileScanner {
  constructor() {
    this.currentScan = null;
    this.abortController = null;
    this.stats = {
      totalScanned: 0,
      totalErrors: 0,
      lastScanTime: null,
    };
  }

  /**
   * 开始扫描
   */
  async scan(rootPath, options = {}) {
    if (this.currentScan) {
      throw new Error('Another scan is already in progress');
    }

    this.abortController = new AbortController();
    this.currentScan = { path: rootPath, startTime: Date.now() };

    try {
      const result = await scanDirectory(rootPath, {
        ...options,
        signal: this.abortController.signal,
      });

      this.stats.totalScanned += result.scanned;
      this.stats.totalErrors += result.errors.length;
      this.stats.lastScanTime = Date.now();

      return result;
    } finally {
      this.currentScan = null;
      this.abortController = null;
    }
  }

  /**
   * 取消当前扫描
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      return true;
    }
    return false;
  }

  /**
   * 是否正在扫描
   */
  isScanning() {
    return this.currentScan !== null;
  }

  /**
   * 获取扫描状态
   */
  getStatus() {
    if (!this.currentScan) return null;

    return {
      path: this.currentScan.path,
      elapsed: Date.now() - this.currentScan.startTime,
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats };
  }
}

module.exports = {
  FileScanner,
  scanDirectory,
  quickScan,
  parallelScan,
  isImageFile,
  generateFileHash,
  SUPPORTED_EXTS,
};
