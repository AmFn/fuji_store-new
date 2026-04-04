/**
 * 照片服务主模块 - 整合所有功能
 * 功能：扫描、监听、缩略图生成、数据库管理、IPC 接口
 */

const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const exifr = require('exifr');
const { PhotoDatabase } = require('../database/db.cjs');
const { FileScanner, scanDirectory } = require('./fileScanner.cjs');
const { SmartFileWatcher } = require('./fileWatcher.cjs');
const { ThumbnailQueue } = require('./thumbnailQueue.cjs');
const { shell } = require('electron');

/**
 * 照片管理服务
 */
class PhotoService {
  constructor(options = {}) {
    this.dbPath = options.dbPath || path.join(process.cwd(), 'database', 'photos.db');
    this.cacheDir = options.cacheDir || path.join(process.cwd(), 'cache', 'thumbnails');
    this.onLibraryUpdated = options.onLibraryUpdated || null;

    // 初始化组件
    this.db = new PhotoDatabase(this.dbPath);
    this.scanner = new FileScanner();
    this.watcher = new SmartFileWatcher(this.db);
    this.thumbnailQueue = new ThumbnailQueue({
      cacheDir: this.cacheDir,
      database: this.db,
      concurrency: 4,
    });

    // 绑定事件
    this._bindEvents();

    console.log('[PhotoService] Initialized');
  }

  /**
   * 绑定事件监听
   */
  _bindEvents() {
    // 监听文件变化
    this.watcher.on('file:add', (data) => {
      console.log('[PhotoService] File added:', data.path);
      this._notify({ type: 'file:add', path: data.path });
    });

    this.watcher.on('file:change', (data) => {
      console.log('[PhotoService] File changed:', data.path);
      this._notify({ type: 'file:change', path: data.path });
    });

    this.watcher.on('file:unlink', (data) => {
      console.log('[PhotoService] File removed:', data.path);
      this._notify({ type: 'file:unlink', path: data.path });
    });

    // 监听缩略图任务事件
    this.thumbnailQueue.on('task:started', (data) => {
      this._notify({ type: 'thumbnail:started', ...data });
    });

    this.thumbnailQueue.on('task:success', (data) => {
      this._notify({ type: 'thumbnail:success', ...data });
    });

    this.thumbnailQueue.on('task:error', (data) => {
      this._notify({ type: 'thumbnail:error', ...data });
    });
  }

  /**
   * 通知前端更新
   */
  _notify(payload) {
    if (typeof this.onLibraryUpdated === 'function') {
      this.onLibraryUpdated(payload);
    }
  }

  /**
   * 获取文件信息
   */
  async _getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      // 标准化路径格式，使用正斜杠
      const normalizedPath = filePath.replace(/\\/g, '/');
      return {
        path: normalizedPath,
        size: stats.size,
        created_at: Math.floor(stats.birthtimeMs || stats.ctimeMs || stats.mtimeMs),
        updated_at: Math.floor(stats.mtimeMs),
        hash: this._generateFileHash(normalizedPath, stats),
      };
    } catch (err) {
      console.error(`[PhotoService] Failed to stat file: ${filePath}`, err.message);
      return null;
    }
  }

  /**
   * 提取照片元数据
   */
  async _extractMetadata(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const isRaw = ['.raf', '.cr2', '.nef', '.arw', '.dng', '.raw', '.rw2', '.orf', '.srw'].includes(ext);
      
      // 使用 exifr 提取元数据
      const metadata = await exifr.parse(filePath, {
        tiff: true,
        xmp: true,
        icc: true,
        jfif: true,
        ihdr: true,
        fujifilm: true,
      }).catch(() => ({}));

      // 获取图片尺寸
      let width = 0;
      let height = 0;
      
      if (isRaw) {
        // 对于 RAW 文件，尝试从预览图获取尺寸
        try {
          const preview = await exifr.thumbnail(filePath);
          if (preview) {
            const sharp = require('sharp');
            const imgMetadata = await sharp(Buffer.from(preview)).metadata();
            width = imgMetadata.width || 0;
            height = imgMetadata.height || 0;
          }
        } catch (e) {
          console.warn(`[PhotoService] Failed to get RAW preview dimensions: ${filePath}`, e.message);
        }
        
        // 如果预览图获取失败，从 EXIF 获取
        if (width === 0 || height === 0) {
          width = metadata.ImageWidth || metadata.ExifImageWidth || metadata.PixelXDimension || 0;
          height = metadata.ImageHeight || metadata.ExifImageHeight || metadata.PixelYDimension || 0;
        }
      } else {
        // 非 RAW 文件，使用 sharp 直接获取
        try {
          const sharp = require('sharp');
          const imgMetadata = await sharp(filePath).metadata();
          width = imgMetadata.width || 0;
          height = imgMetadata.height || 0;
        } catch (e) {
          // 如果 sharp 失败，尝试从 EXIF 获取
          width = metadata.ImageWidth || metadata.ExifImageWidth || 0;
          height = metadata.ImageHeight || metadata.ExifImageHeight || 0;
        }
      }

      return {
        width,
        height,
        cameraModel: metadata.Model || 'Unknown Camera',
        lensModel: metadata.LensModel || 'Unknown Lens',
        filmMode: metadata.FilmMode || 'Provia/Standard',
        dateTime: metadata.DateTimeOriginal ? new Date(metadata.DateTimeOriginal).toISOString() : new Date().toISOString(),
        exposureTime: metadata.ExposureTime ? `1/${Math.round(1/metadata.ExposureTime)}` : 'N/A',
        fNumber: metadata.FNumber ? `f/${metadata.FNumber}` : 'N/A',
        iso: metadata.ISO || 0,
        focalLength: metadata.FocalLength ? `${metadata.FocalLength}mm` : 'N/A',
        whiteBalance: metadata.WhiteBalance || 'Auto',
        whiteBalanceShift: metadata.WhiteBalanceShift || '0,0',
        dynamicRange: metadata.DynamicRange || '100%',
        sharpness: metadata.Sharpness?.toString() || '0',
        saturation: metadata.Saturation?.toString() || '0',
        contrast: metadata.Contrast?.toString() || '0',
        clarity: metadata.Clarity?.toString() || '0',
        shadowTone: metadata.ShadowTone?.toString() || '0',
        highlightTone: metadata.HighlightTone?.toString() || '0',
        noiseReduction: metadata.NoiseReduction?.toString() || '0',
        grainEffect: metadata.GrainEffect || 'Off',
        colorChromeEffect: metadata.ColorChromeEffect || 'Off',
        colorChromeEffectBlue: metadata.ColorChromeEffectBlue || 'Off',
      };
    } catch (err) {
      console.error(`[PhotoService] Failed to extract metadata: ${filePath}`, err.message);
      return {
        width: 0,
        height: 0,
        cameraModel: 'Unknown Camera',
        lensModel: 'Unknown Lens',
        filmMode: 'Provia/Standard',
        dateTime: new Date().toISOString(),
      };
    }
  }

  /**
   * 生成文件 hash
   */
  _generateFileHash(filePath, stats) {
    const data = `${filePath}:${stats.size}:${stats.mtimeMs}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * 扫描目录
   * @param {string} folderPath - 目录路径
   * @param {boolean} watch - 是否启用监听
   * @returns {Promise<Object>} 扫描结果
   */
  async scanFolder(folderPath, watch = true) {
    console.log(`[PhotoService] Scanning folder: ${folderPath}`);

    // 更新扫描状态
    this.db.updateScanStatus(folderPath, {
      status: 'scanning',
      last_scan_at: Date.now(),
    });

    const startTime = Date.now();
    let scanned = 0;

    try {
      // 执行扫描
      const result = await this.scanner.scan(folderPath, {
        recursive: true,
        onProgress: (progress) => {
          this._notify({
            type: 'scan:progress',
            folderPath,
            ...progress,
          });
        },
        onFile: async (fileInfo) => {
          // 检查是否已存在
          const existing = this.db.getPhotoByPath(fileInfo.path);
          if (existing && existing.hash === fileInfo.hash) {
            return; // 文件未变化，跳过
          }

          // 提取元数据
          const metadata = await this._extractMetadata(fileInfo.path);

          // 添加到数据库
          this.db.upsertPhoto({
            path: fileInfo.path,
            hash: fileInfo.hash,
            size: fileInfo.size,
            width: metadata.width,
            height: metadata.height,
            created_at: fileInfo.created_at,
            updated_at: fileInfo.updated_at,
            thumbnail_status: 'pending',
            metadata_json: JSON.stringify(metadata),
          });

          // 添加到缩略图队列
          this.thumbnailQueue.add(fileInfo.path, fileInfo.hash).catch((err) => {
            console.error('[PhotoService] Thumbnail error:', err.message);
          });

          scanned++;
        },
      });

      // 更新扫描状态
      this.db.updateScanStatus(folderPath, {
        status: 'completed',
        last_scan_at: Date.now(),
        total_files: result.scanned,
        scanned_files: result.scanned - result.errors.length,
      });

      // 启动文件监听
      if (watch) {
        this.watcher.watch(folderPath);
      }

      // 执行一致性校验
      await this._verifyConsistency(folderPath);

      const summary = {
        scanned: result.scanned,
        failures: result.errors.length,
        duration: Date.now() - startTime,
        folderPath,
      };

      this._notify({ type: 'scan:completed', ...summary });

      return summary;
    } catch (err) {
      console.error('[PhotoService] Scan failed:', err);

      this.db.updateScanStatus(folderPath, {
        status: 'error',
        last_scan_at: Date.now(),
      });

      throw err;
    }
  }

  /**
   * 扫描文件列表
   * @param {string[]} filePaths - 文件路径列表
   * @returns {Promise<Object>} 扫描结果
   */
  async scanFiles(filePaths) {
    console.log(`[PhotoService] Scanning ${filePaths.length} files`);

    const startTime = Date.now();
    let scanned = 0;
    let failures = 0;

    try {
      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        
        // 进度通知
        this._notify({
          type: 'scan:progress',
          current: i + 1,
          total: filePaths.length,
          path: filePath,
        });

        // 获取文件信息
        const fileInfo = await this._getFileInfo(filePath);
        if (!fileInfo) {
          failures++;
          continue;
        }

        // 检查是否已存在
        const existing = this.db.getPhotoByPath(fileInfo.path);
        if (existing && existing.hash === fileInfo.hash) {
          console.log(`[PhotoService] File already exists and unchanged: ${fileInfo.path}`);
          continue; // 文件未变化，跳过
        }

        // 提取元数据
        console.log(`[PhotoService] Extracting metadata for: ${fileInfo.path}`);
        const metadata = await this._extractMetadata(fileInfo.path);
        console.log(`[PhotoService] Metadata extracted:`, metadata);

        // 添加到数据库
        const result = this.db.upsertPhoto({
          path: fileInfo.path,
          hash: fileInfo.hash,
          size: fileInfo.size,
          width: metadata.width,
          height: metadata.height,
          created_at: fileInfo.created_at,
          updated_at: fileInfo.updated_at,
          thumbnail_status: 'pending',
          metadata_json: JSON.stringify(metadata),
        });
        console.log(`[PhotoService] Upsert result:`, result);

        // 添加到缩略图队列
        this.thumbnailQueue.add(fileInfo.path, fileInfo.hash).catch((err) => {
          console.error('[PhotoService] Thumbnail error:', err.message);
        });

        scanned++;
        console.log(`[PhotoService] Scanned file: ${fileInfo.path}`);
      }

      const summary = {
        scanned,
        failures,
        duration: Date.now() - startTime,
        total: filePaths.length,
      };

      this._notify({ type: 'scan:completed', ...summary });

      return summary;
    } catch (err) {
      console.error('[PhotoService] Scan files failed:', err);
      throw err;
    }
  }

  /**
   * 获取照片列表（分页）
   */
  getPhotos(page = 1, pageSize = 120) {
    return this.db.getPhotosPage(page, pageSize);
  }

  /**
   * 获取照片总数
   */
  getPhotoCount() {
    return this.db.countPhotos();
  }

  /**
   * 获取扫描进度
   */
  getScanProgress(folderPath) {
    const status = this.db.getScanStatus(folderPath);
    const scannerStatus = this.scanner.getStatus();

    return {
      dbStatus: status,
      scannerStatus,
      isScanning: this.scanner.isScanning(),
    };
  }

  /**
   * 重新同步库
   */
  async resyncLibrary() {
    console.log('[PhotoService] Resyncing library...');

    const watchedPaths = this.watcher.getStatus().watchedPaths;
    const results = [];

    for (const folderPath of watchedPaths) {
      const result = await this.scanFolder(folderPath, false);
      results.push({ folderPath, ...result });
    }

    // 处理所有待生成的缩略图
    await this.thumbnailQueue.processPendingFromDB(1000);

    return {
      folders: results,
      totalScanned: results.reduce((sum, r) => sum + r.scanned, 0),
    };
  }

  /**
   * 更新照片元数据
   */
  updatePhoto(photoPath, metadata) {
    const result = this.db.updatePhotoMetadata(photoPath, metadata);
    this._notify({ type: 'photo:updated', path: photoPath, metadata });
    return result;
  }

  /**
   * 删除照片
   */
  removePhoto(photoPath) {
    this.db.markPhotoDeleted(photoPath);
    this._notify({ type: 'photo:removed', path: photoPath });
  }

  /**
   * 在文件夹中显示照片
   */
  showInFolder(photoPath) {
    shell.showItemInFolder(photoPath);
  }

  /**
   * 获取监听状态
   */
  getWatchedFolders() {
    return this.watcher.getStatus();
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      database: this.db.getStats(),
      scanner: this.scanner.getStats(),
      watcher: this.watcher.getStatus(),
      thumbnailQueue: this.thumbnailQueue.getStatus(),
    };
  }

  /**
   * 获取日期分组信息
   */
  getDateGroups() {
    return this.db.getDateGroups();
  }

  /**
   * 按日期获取照片
   */
  getPhotosByDate(dateStr, limit = 0, preferThumbnail = true) {
    return this.db.getPhotosByDate(dateStr, limit, preferThumbnail);
  }

  /**
   * 一致性校验
   */
  async _verifyConsistency(folderPath) {
    const results = await this.watcher.verifyConsistency(folderPath);

    // 自动修复不一致
    if (results.missingFiles.length > 0 || results.orphanedFiles.length > 0) {
      console.log(`[PhotoService] Auto-fixing ${results.missingFiles.length} missing, ${results.orphanedFiles.length} orphaned`);
      await this.watcher.fixInconsistency(folderPath);
    }

    return results;
  }

  /**
   * 根据ID删除照片
   * @param {string} photoId - 照片ID
   */
  async deletePhoto(photoId) {
    console.log(`[PhotoService] Deleting photo: ${photoId}`);
    
    try {
      // 1. 获取照片信息
      const photo = await this.db.getPhotoById(photoId);
      if (!photo) {
        throw new Error('Photo not found');
      }

      // 2. 从数据库中删除
      await this.db.deletePhotoById(photoId);
      
      // 3. 清理缩略图缓存
      if (photo.hash) {
        this.thumbnailQueue.removeByHash(photo.hash);
      }

      console.log(`[PhotoService] Photo deleted: ${photoId}`);
    } catch (error) {
      console.error(`[PhotoService] Failed to delete photo ${photoId}:`, error);
      throw error;
    }
  }

  /**
   * 停止所有服务
   */
  async stop() {
    console.log('[PhotoService] Stopping...');

    // 停止扫描
    this.scanner.cancel();

    // 停止监听
    this.watcher.stopAll();

    // 等待缩略图队列完成
    await this.thumbnailQueue.onIdle();

    // 关闭数据库
    this.db.close();

    console.log('[PhotoService] Stopped');
  }

  /**
   * 扫描文件夹获取新文件
   * @param {string} folderPath - 文件夹路径
   * @returns {Promise<{newFiles: Array}>} - 新文件列表
   */
  async scanFolderForNewFiles(folderPath) {
    console.log(`[PhotoService] Scanning for new files in: ${folderPath}`);
    
    try {
      // 获取数据库中已存在的所有路径
      const existingRows = this.db.getAllPaths();
      const existingPaths = new Set(existingRows.map(p => p.path.replace(/\\/g, '/').toLowerCase()));
      
      // 扫描文件夹
      const scanResult = await scanDirectory(folderPath, true);
      const files = scanResult.files || [];
      
      // 过滤出新文件
      const newFiles = files.filter(file => {
        const normalizedPath = file.path.replace(/\\/g, '/').toLowerCase();
        return !existingPaths.has(normalizedPath);
      });
      
      console.log(`[PhotoService] Found ${newFiles.length} new files in ${folderPath}`);
      
      // 返回新文件信息
      return {
        newFiles: newFiles.map(file => ({
          path: file.path,
          fileName: file.path.split(/[\\/]/).pop(),
          size: file.size,
          date: new Date().toISOString(),
        })),
      };
    } catch (error) {
      console.error(`[PhotoService] Failed to scan for new files: ${error.message}`);
      throw error;
    }
  }

  /**
   * 扫描文件夹获取所有文件（包括已存在的和软删除的）
   * @param {string} folderPath - 文件夹路径
   * @returns {Promise<{allFiles: Array, existingPaths: Array, deletedPaths: Array}>} - 所有文件信息
   */
  async scanFolderAllFiles(folderPath) {
    console.log(`[PhotoService] Scanning all files in: ${folderPath}`);
    
    try {
      // 获取数据库中该文件夹下未删除的照片
      const activeDbPhotos = this.db.getActivePhotosByFolderPath(folderPath);
      
      console.log(`[PhotoService] Active photos in DB for this folder:`, activeDbPhotos.length);
      console.log(`[PhotoService] Sample DB paths:`, activeDbPhotos.slice(0, 3).map(p => p.path));
      
      const activeDbPaths = new Set(activeDbPhotos.map(p => p.path.replace(/\\/g, '/').toLowerCase()));
      // 创建 path -> hash 的映射
      const pathToHash = new Map();
      for (const p of activeDbPhotos) {
        pathToHash.set(p.path.replace(/\\/g, '/').toLowerCase(), p.hash);
      }
      
      // 扫描文件夹获取当前存在的文件
      const scanResult = await scanDirectory(folderPath, true);
      const files = scanResult.files || [];
      
      console.log(`[PhotoService] Files from scan:`, files.slice(0, 3).map(f => f.path));
      
      const folderPaths = new Set(files.map(f => f.path.replace(/\\/g, '/').toLowerCase()));
      
      // 合并：当前存在的文件 + 数据库中软删除的文件
      const allFiles = [];
      
      // 添加当前存在的文件
      for (const file of files) {
        const normalizedPath = file.path.replace(/\\/g, '/').toLowerCase();
        const isInDb = activeDbPaths.has(normalizedPath);
        const hash = pathToHash.get(normalizedPath);
        allFiles.push({
          path: file.path,
          fileName: file.path.split(/[\\/]/).pop(),
          size: file.size,
          date: new Date().toISOString(),
          exists: isInDb,  // 在数据库中存在且未删除
          inFolder: true,  // 当前在文件夹中
          hash: hash || null,
        });
      }
      
      // 添加数据库中软删除的文件（不在当前文件夹中但之前属于这个文件夹）
      for (const photo of activeDbPhotos) {
        const normalizedPath = photo.path.replace(/\\/g, '/').toLowerCase();
        if (!folderPaths.has(normalizedPath)) {
          allFiles.push({
            path: photo.path,
            fileName: photo.path.split(/[\\/]/).pop(),
            size: photo.size || 0,
            date: new Date(photo.created_at).toISOString(),
            exists: true,  // 在数据库中存在
            inFolder: false,  // 不在当前文件夹中（已被删除）
            hash: photo.hash || null,
          });
        }
      }
      
      console.log(`[PhotoService] Found ${allFiles.length} total files (${files.length} in folder, ${activeDbPhotos.length - files.length} deleted)`);
      
      return {
        allFiles,
        existingPaths: Array.from(activeDbPaths),
        deletedPaths: [],
      };
    } catch (error) {
      console.error(`[PhotoService] Failed to scan all files: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { PhotoService };
