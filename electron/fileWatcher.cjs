/**
 * 文件监听模块 - 使用 chokidar
 * 功能：监听文件变化、防抖处理、事件去重、自动同步数据库
 */

const chokidar = require('chokidar');
const path = require('node:path');
const { EventEmitter } = require('node:events');

// 监听配置
const WATCHER_CONFIG = {
  // chokidar 配置
  CHOKIDAR: {
    ignored: [
      /(^|[\/\\])\../,           // 隐藏文件
      /node_modules/,             // node_modules
      /(^|[\/\\])\.git/,        // git 目录
      /(^|[\/\\])\.DS_Store/,    // macOS 系统文件
      /(^|[\/\\])Thumbs\.db/,    // Windows 缩略图缓存
    ],
    persistent: true,
    ignoreInitial: true,          // 忽略初始扫描
    followSymlinks: false,
    awaitWriteFinish: {
      stabilityThreshold: 500,    // 等待文件写入稳定
      pollInterval: 100,
    },
    depth: 99,                    // 递归深度
  },
  // 防抖配置
  DEBOUNCE: {
    ADD: 300,      // 新增防抖时间(ms)
    CHANGE: 500,   // 修改防抖时间(ms)
    UNLINK: 100,   // 删除防抖时间(ms)
  },
  // 批处理配置
  BATCH: {
    MAX_SIZE: 50,     // 最大批处理数量
    INTERVAL: 1000,   // 批处理间隔(ms)
  },
};

/**
 * 防抖函数
 */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 批量处理器
 */
class BatchProcessor {
  constructor(options = {}) {
    this.maxSize = options.maxSize || WATCHER_CONFIG.BATCH.MAX_SIZE;
    this.interval = options.interval || WATCHER_CONFIG.BATCH.INTERVAL;
    this.batch = [];
    this.timer = null;
    this.processing = false;
  }

  add(item) {
    // 去重：如果同一文件已在队列中，更新为最新状态
    const existingIndex = this.batch.findIndex(i => i.path === item.path);
    if (existingIndex >= 0) {
      // 合并事件
      const existing = this.batch[existingIndex];
      this.batch[existingIndex] = {
        ...existing,
        ...item,
        events: [...(existing.events || [existing.type]), item.type],
        timestamp: Date.now(),
      };
      return;
    }

    this.batch.push({ ...item, timestamp: Date.now() });

    // 达到批次大小立即处理
    if (this.batch.length >= this.maxSize) {
      this.flush();
    } else if (!this.timer) {
      // 启动定时器
      this.timer = setTimeout(() => this.flush(), this.interval);
    }
  }

  async flush() {
    if (this.processing || this.batch.length === 0) return;

    this.processing = true;
    clearTimeout(this.timer);
    this.timer = null;

    const currentBatch = [...this.batch];
    this.batch = [];

    try {
      await this.onProcess(currentBatch);
    } catch (err) {
      console.error('[BatchProcessor] Error processing batch:', err);
    } finally {
      this.processing = false;
      // 如果处理过程中有新添加的项，继续处理
      if (this.batch.length > 0) {
        this.timer = setTimeout(() => this.flush(), this.interval);
      }
    }
  }

  onProcess(batch) {
    // 子类重写
    console.log(`[BatchProcessor] Processing ${batch.length} items`);
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
    this.batch = [];
  }
}

/**
 * 文件监听器类
 */
class FileWatcher extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.watchers = new Map();      // 路径 -> watcher 实例
    this.watchedPaths = new Set();  // 已监听路径集合
    this.options = { ...WATCHER_CONFIG.CHOKIDAR, ...options };
    
    // 批处理器 - 使用箭头函数绑定，子类可以重写 _processXXX 方法
    this.addBatchProcessor = new BatchProcessor({
      maxSize: 20,
      interval: 500,
    });
    this.addBatchProcessor.onProcess = (batch) => this._processAddBatch(batch);

    this.changeBatchProcessor = new BatchProcessor({
      maxSize: 30,
      interval: 1000,
    });
    this.changeBatchProcessor.onProcess = (batch) => this._processChangeBatch(batch);

    this.unlinkBatchProcessor = new BatchProcessor({
      maxSize: 50,
      interval: 300,
    });
    this.unlinkBatchProcessor.onProcess = (batch) => this._processUnlinkBatch(batch);

    // 防抖处理的事件处理器
    this.debouncedAdd = debounce(this._handleAdd.bind(this), WATCHER_CONFIG.DEBOUNCE.ADD);
    this.debouncedChange = debounce(this._handleChange.bind(this), WATCHER_CONFIG.DEBOUNCE.CHANGE);
    this.debouncedUnlink = debounce(this._handleUnlink.bind(this), WATCHER_CONFIG.DEBOUNCE.UNLINK);
  }

  /**
   * 开始监听目录
   */
  watch(folderPath, options = {}) {
    if (this.watchers.has(folderPath)) {
      console.log(`[Watcher] Already watching: ${folderPath}`);
      return false;
    }

    console.log(`[Watcher] Starting watch: ${folderPath}`);

    const watcher = chokidar.watch(folderPath, {
      ...this.options,
      ...options,
    });

    // 绑定事件
    watcher.on('add', (filePath, stats) => {
      this.debouncedAdd(filePath, stats);
    });

    watcher.on('change', (filePath, stats) => {
      this.debouncedChange(filePath, stats);
    });

    watcher.on('unlink', (filePath) => {
      this.debouncedUnlink(filePath);
    });

    watcher.on('addDir', (dirPath) => {
      this.emit('addDir', dirPath);
    });

    watcher.on('unlinkDir', (dirPath) => {
      this.emit('unlinkDir', dirPath);
    });

    watcher.on('error', (error) => {
      console.error(`[Watcher] Error watching ${folderPath}:`, error);
      this.emit('error', { path: folderPath, error });
    });

    watcher.on('ready', () => {
      console.log(`[Watcher] Ready: ${folderPath}`);
      this.emit('ready', folderPath);
    });

    this.watchers.set(folderPath, watcher);
    this.watchedPaths.add(folderPath);

    return true;
  }

  /**
   * 停止监听目录
   */
  unwatch(folderPath) {
    const watcher = this.watchers.get(folderPath);
    if (!watcher) return false;

    watcher.close();
    this.watchers.delete(folderPath);
    this.watchedPaths.delete(folderPath);
    
    console.log(`[Watcher] Stopped watching: ${folderPath}`);
    return true;
  }

  /**
   * 停止所有监听
   */
  stopAll() {
    for (const [path, watcher] of this.watchers) {
      watcher.close();
      console.log(`[Watcher] Stopped: ${path}`);
    }
    this.watchers.clear();
    this.watchedPaths.clear();

    // 停止批处理器
    this.addBatchProcessor.stop();
    this.changeBatchProcessor.stop();
    this.unlinkBatchProcessor.stop();
  }

  /**
   * 获取监听状态
   */
  getStatus() {
    return {
      watchedPaths: Array.from(this.watchedPaths),
      watcherCount: this.watchers.size,
      pendingBatches: {
        add: this.addBatchProcessor.batch.length,
        change: this.changeBatchProcessor.batch.length,
        unlink: this.unlinkBatchProcessor.batch.length,
      },
    };
  }

  /**
   * 处理新增文件（内部）
   */
  _handleAdd(filePath, stats) {
    // 过滤非图片文件
    if (!this._isImageFile(filePath)) return;

    this.addBatchProcessor.add({
      type: 'add',
      path: filePath,
      stats,
      timestamp: Date.now(),
    });
  }

  /**
   * 处理修改文件（内部）
   */
  _handleChange(filePath, stats) {
    if (!this._isImageFile(filePath)) return;

    this.changeBatchProcessor.add({
      type: 'change',
      path: filePath,
      stats,
      timestamp: Date.now(),
    });
  }

  /**
   * 处理删除文件（内部）
   */
  _handleUnlink(filePath) {
    if (!this._isImageFile(filePath)) return;

    this.unlinkBatchProcessor.add({
      type: 'unlink',
      path: filePath,
      timestamp: Date.now(),
    });
  }

  /**
   * 处理新增批次
   */
  async _processAddBatch(batch) {
    console.log(`[Watcher] Processing ${batch.length} added files`);
    
    for (const item of batch) {
      this.emit('file:add', {
        path: item.path,
        stats: item.stats,
      });
    }
  }

  /**
   * 处理修改批次
   */
  async _processChangeBatch(batch) {
    console.log(`[Watcher] Processing ${batch.length} changed files`);
    
    for (const item of batch) {
      this.emit('file:change', {
        path: item.path,
        stats: item.stats,
      });
    }
  }

  /**
   * 处理删除批次
   */
  async _processUnlinkBatch(batch) {
    console.log(`[Watcher] Processing ${batch.length} removed files`);
    
    for (const item of batch) {
      this.emit('file:unlink', {
        path: item.path,
      });
    }
  }

  /**
   * 检查是否为图片文件
   */
  _isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const imageExts = new Set([
      '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif',
      '.raw', '.cr2', '.nef', '.arw', '.dng', '.raf'
    ]);
    return imageExts.has(ext);
  }
}

/**
 * 智能文件监听器（带数据库同步）
 */
class SmartFileWatcher extends FileWatcher {
  constructor(database, options = {}) {
    super(options);
    this.db = database;
    this.syncEnabled = true;
    this.processingQueue = new Map(); // 防止重复处理
  }

  /**
   * 启用/禁用自动同步
   */
  setSyncEnabled(enabled) {
    this.syncEnabled = enabled;
  }

  /**
   * 处理新增文件（同步到数据库）
   */
  async _processAddBatch(batch) {
    if (!this.syncEnabled) {
      // 调用父类方法
      for (const item of batch) {
        this.emit('file:add', {
          path: item.path,
          stats: item.stats,
        });
      }
      return;
    }

    const photos = [];
    
    for (const item of batch) {
      // 检查是否已存在
      const existing = this.db.getPhotoByPath(item.path);
      if (existing) {
        // 文件已存在，可能是移动后重新添加
        this.db.restorePhoto(item.path);
        this.emit('file:restore', { path: item.path });
        continue;
      }

      photos.push({
        path: item.path,
        size: item.stats?.size || 0,
        created_at: item.stats?.birthtimeMs || Date.now(),
        updated_at: Date.now(),
        thumbnail_status: 'pending',
      });

      this.emit('file:add', { path: item.path, stats: item.stats });
    }

    // 批量插入数据库
    if (photos.length > 0) {
      this.db.batchUpsertPhotos(photos);
      console.log(`[SmartWatcher] Added ${photos.length} photos to database`);
    }
  }

  /**
   * 处理修改文件（更新数据库）
   */
  async _processChangeBatch(batch) {
    if (!this.syncEnabled) {
      // 调用父类方法
      for (const item of batch) {
        this.emit('file:change', {
          path: item.path,
          stats: item.stats,
        });
      }
      return;
    }

    for (const item of batch) {
      const existing = this.db.getPhotoByPath(item.path);
      if (existing) {
        // 更新文件信息
        this.db.upsertPhoto({
          ...existing,
          size: item.stats?.size || existing.size,
          updated_at: Date.now(),
          thumbnail_status: 'pending', // 需要重新生成缩略图
        });
      }

      this.emit('file:change', { path: item.path, stats: item.stats });
    }
  }

  /**
   * 处理删除文件（标记删除）
   */
  async _processUnlinkBatch(batch) {
    if (!this.syncEnabled) {
      // 调用父类方法
      for (const item of batch) {
        this.emit('file:unlink', {
          path: item.path,
        });
      }
      return;
    }

    for (const item of batch) {
      // 软删除
      this.db.markPhotoDeleted(item.path);
      this.emit('file:unlink', { path: item.path });
    }

    console.log(`[SmartWatcher] Marked ${batch.length} photos as deleted`);
  }

  /**
   * 执行一致性校验
   * 检查数据库记录与实际文件的一致性
   */
  async verifyConsistency(folderPath) {
    console.log(`[SmartWatcher] Verifying consistency: ${folderPath}`);
    
    const fs = require('node:fs/promises');
    const results = {
      missingFiles: [],    // 数据库有记录但文件不存在
      orphanedFiles: [],   // 文件存在但数据库无记录
      mismatched: [],      // 记录不匹配
    };

    // 获取数据库中的所有路径
    const dbPaths = this.db.getAllPaths();
    const dbPathSet = new Set(dbPaths);

    // 扫描实际文件
    const { quickScan } = require('./fileScanner.cjs');
    const actualFiles = await quickScan(folderPath);
    const actualPathSet = new Set(actualFiles);

    // 检查缺失文件
    for (const dbPath of dbPaths) {
      if (!actualPathSet.has(dbPath)) {
        results.missingFiles.push(dbPath);
      }
    }

    // 检查孤立文件
    for (const actualPath of actualFiles) {
      if (!dbPathSet.has(actualPath)) {
        results.orphanedFiles.push(actualPath);
      }
    }

    console.log(`[SmartWatcher] Consistency check: ${results.missingFiles.length} missing, ${results.orphanedFiles.length} orphaned`);

    return results;
  }

  /**
   * 修复不一致
   */
  async fixInconsistency(folderPath) {
    const results = await this.verifyConsistency(folderPath);

    // 标记缺失文件为已删除
    for (const missingPath of results.missingFiles) {
      this.db.markPhotoDeleted(missingPath);
    }

    // 添加孤立文件到数据库
    if (results.orphanedFiles.length > 0) {
      const photos = results.orphanedFiles.map(path => ({
        path,
        size: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
        thumbnail_status: 'pending',
      }));
      this.db.batchUpsertPhotos(photos);
    }

    console.log(`[SmartWatcher] Fixed: marked ${results.missingFiles.length} deleted, added ${results.orphanedFiles.length} new`);

    return results;
  }
}

module.exports = {
  FileWatcher,
  SmartFileWatcher,
  BatchProcessor,
  WATCHER_CONFIG,
};
