/**
 * 数据库模块 - 使用 better-sqlite3
 * 功能：照片元数据存储、索引管理、批量操作
 */

const Database = require('better-sqlite3');
const path = require('node:path');
const fs = require('node:fs');

// 数据库迁移脚本
const MIGRATIONS = [
  {    version: 1,    name: 'create_photos_table',    up: (db) => {      db.exec(`        CREATE TABLE IF NOT EXISTS photos (          id INTEGER PRIMARY KEY AUTOINCREMENT,          path TEXT NOT NULL UNIQUE,          hash TEXT NOT NULL,          size INTEGER NOT NULL,          width INTEGER NOT NULL,          height INTEGER NOT NULL,          created_at INTEGER NOT NULL,          shot_at INTEGER,          updated_at INTEGER NOT NULL,          thumbnail_status TEXT NOT NULL DEFAULT 'pending',          is_deleted INTEGER NOT NULL DEFAULT 0,          is_favorite INTEGER NOT NULL DEFAULT 0,          is_hidden INTEGER NOT NULL DEFAULT 0,          rating INTEGER NOT NULL DEFAULT 0,          tags_json TEXT NOT NULL DEFAULT '[]',          metadata_json TEXT DEFAULT '{}',          is_recipe_display INTEGER NOT NULL DEFAULT 0        );      `);    },  },
  {
    version: 2,
    name: 'create_indexes',
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_photos_path ON photos(path);
        CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_photos_hash ON photos(hash);
        CREATE INDEX IF NOT EXISTS idx_photos_deleted ON photos(is_deleted);
        CREATE INDEX IF NOT EXISTS idx_photos_thumbnail_status ON photos(thumbnail_status);
      `);
    },
  },
  {
    version: 3,
    name: 'create_scan_status_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS scan_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          folder_path TEXT NOT NULL UNIQUE,
          last_scan_at INTEGER,
          total_files INTEGER DEFAULT 0,
          scanned_files INTEGER DEFAULT 0,
          status TEXT DEFAULT 'idle'
        );
      `);
    },
  },
  {
    version: 4,
    name: 'create_folders_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          path TEXT,
          parent_id INTEGER,
          include_subfolders INTEGER NOT NULL DEFAULT 1,
          photo_count INTEGER NOT NULL DEFAULT 0,
          last_synced INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
        );
      `);
    },
  },
  {
    version: 5,
    name: 'add_shot_at_column',
    up: (db) => {
      db.exec('ALTER TABLE photos ADD COLUMN shot_at INTEGER');
    },
  },
  {
    version: 6,
    name: 'add_recipe_display_column',
    up: (db) => {
      db.exec('ALTER TABLE photos ADD COLUMN is_recipe_display INTEGER NOT NULL DEFAULT 0');
    },
  },
  {
    version: 7,
    name: 'create_metadata_mapping_tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS metadata_mapping_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          field_name TEXT NOT NULL,
          json_path TEXT NOT NULL,
          is_enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(field_name)
        );

        CREATE TABLE IF NOT EXISTS metadata_presets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          config_json TEXT NOT NULL DEFAULT '{}',
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_metadata_configs_field ON metadata_mapping_configs(field_name);
        CREATE INDEX IF NOT EXISTS idx_metadata_presets_default ON metadata_presets(is_default);
      `);
    },
  },
];

class PhotoDatabase {
  constructor(dbPath) {
    // 确保目录存在
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    
    // 性能优化设置
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = memory');
    this.db.pragma('mmap_size = 268435456'); // 256MB memory map

    this.#initMigrations();
    this.#runMigrations();
    this.#prepareStatements();
  }

  /**
   * 初始化迁移表
   */
  #initMigrations() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `);
  }

  /**
   * 执行数据库迁移
   */
  #runMigrations() {
    const appliedRows = this.db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all();
    const appliedVersions = new Set(appliedRows.map((row) => row.version));

    for (const migration of MIGRATIONS) {
      if (appliedVersions.has(migration.version)) continue;
      
      const run = this.db.transaction(() => {
        migration.up(this.db);
        this.db
          .prepare('INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, Date.now());
      });
      
      run();
      console.log(`[DB] Migration ${migration.version}: ${migration.name} applied`);
    }
  }

  /**
   * 预编译 SQL 语句（提升性能）
   */
  #prepareStatements() {
    this.stmts = {
      // 照片操作
      upsertPhoto: this.db.prepare(`
        INSERT INTO photos (
          path, hash, size, width, height, created_at, shot_at, updated_at,
          thumbnail_status, is_deleted, is_favorite, is_hidden, rating, tags_json, metadata_json, is_recipe_display
        ) VALUES (
          @path, @hash, @size, @width, @height, @created_at, @shot_at, @updated_at,
          @thumbnail_status, @is_deleted, @is_favorite, @is_hidden, @rating, @tags_json, @metadata_json, @is_recipe_display
        )
        ON CONFLICT(path) DO UPDATE SET
          hash = excluded.hash,
          size = excluded.size,
          width = excluded.width,
          height = excluded.height,
          created_at = excluded.created_at,
          shot_at = excluded.shot_at,
          updated_at = excluded.updated_at,
          thumbnail_status = excluded.thumbnail_status,
          is_deleted = excluded.is_deleted,
          is_recipe_display = excluded.is_recipe_display,
          metadata_json = excluded.metadata_json
      `),

      getPhotoByPath: this.db.prepare('SELECT * FROM photos WHERE path = ? AND is_deleted = 0'),
      
      getPhotoByHash: this.db.prepare('SELECT * FROM photos WHERE hash = ? AND is_deleted = 0'),
      
      getPhotoById: this.db.prepare('SELECT * FROM photos WHERE id = ? AND is_deleted = 0'),

      deletePhotoByPath: this.db.prepare('UPDATE photos SET is_deleted = 1, updated_at = ? WHERE path = ?'),
      
      deletePhotoById: this.db.prepare('UPDATE photos SET is_deleted = 1, updated_at = ? WHERE id = ?'),
      
      hardDeletePhotoByPath: this.db.prepare('DELETE FROM photos WHERE path = ?'),

      markPhotoDeleted: this.db.prepare('UPDATE photos SET is_deleted = 1, updated_at = ? WHERE path = ?'),

      restorePhoto: this.db.prepare('UPDATE photos SET is_deleted = 0, updated_at = ? WHERE path = ?'),

      updateThumbnailStatus: this.db.prepare(`
        UPDATE photos SET thumbnail_status = ?, updated_at = ? WHERE path = ?
      `),

      updatePhotoMetadata: this.db.prepare(`
        UPDATE photos SET 
          is_favorite = ?, 
          is_hidden = ?, 
          rating = ?, 
          tags_json = ?,
          updated_at = ?
        WHERE path = ?
      `),

      // 统计查询
      countPhotos: this.db.prepare('SELECT COUNT(*) AS total FROM photos WHERE is_deleted = 0 AND is_recipe_display = 0'),
      
      countPhotosByStatus: this.db.prepare(`
        SELECT thumbnail_status, COUNT(*) as count 
        FROM photos 
        WHERE is_deleted = 0 AND is_recipe_display = 0
        GROUP BY thumbnail_status
      `),
      
      // 统计配方展示照片
      countRecipeDisplayPhotos: this.db.prepare('SELECT COUNT(*) AS total FROM photos WHERE is_deleted = 0 AND is_recipe_display = 1'),

      // 分页查询
      getPhotosPage: this.db.prepare(`
        SELECT id, path, hash, size, width, height, created_at, shot_at, updated_at,
               thumbnail_status, is_favorite, is_hidden, rating, tags_json, metadata_json
        FROM photos
        WHERE is_deleted = 0 AND is_recipe_display = 0
        ORDER BY shot_at DESC, created_at DESC
        LIMIT ? OFFSET ?
      `),

      // 获取所有路径（用于一致性校验）
      getAllPaths: this.db.prepare('SELECT path FROM photos WHERE is_deleted = 0'),

      getAllPathsIncludingDeleted: this.db.prepare('SELECT path, size, created_at FROM photos'),

      getActivePhotosByFolderPath: this.db.prepare('SELECT id, path, hash, size, created_at FROM photos WHERE is_deleted = 0'),

      // 获取需要生成缩略图的照片（包括失败的需要重试）
      getPendingThumbnails: this.db.prepare(`
        SELECT path, hash FROM photos 
        WHERE thumbnail_status IN ('pending', 'error') AND is_deleted = 0
        LIMIT ?
      `),

      // 扫描状态
      upsertScanStatus: this.db.prepare(`
        INSERT INTO scan_status (folder_path, last_scan_at, total_files, scanned_files, status)
        VALUES (@folder_path, @last_scan_at, @total_files, @scanned_files, @status)
        ON CONFLICT(folder_path) DO UPDATE SET
          last_scan_at = excluded.last_scan_at,
          total_files = excluded.total_files,
          scanned_files = excluded.scanned_files,
          status = excluded.status
      `),

      getScanStatus: this.db.prepare('SELECT * FROM scan_status WHERE folder_path = ?'),

      getAllScanStatus: this.db.prepare('SELECT * FROM scan_status'),

      // 文件夹操作
      insertFolder: this.db.prepare(`
        INSERT INTO folders (name, path, parent_id, include_subfolders, photo_count, last_synced, created_at, updated_at)
        VALUES (@name, @path, @parent_id, @include_subfolders, @photo_count, @last_synced, @created_at, @updated_at)
      `),
      updateFolder: this.db.prepare(`
        UPDATE folders SET name = @name, path = @path, parent_id = @parent_id, 
        include_subfolders = @include_subfolders, photo_count = @photo_count, 
        last_synced = @last_synced, updated_at = @updated_at
        WHERE id = @id
      `),
      deleteFolder: this.db.prepare('DELETE FROM folders WHERE id = ?'),
      getFolderById: this.db.prepare('SELECT * FROM folders WHERE id = ?'),
      getAllFolders: this.db.prepare('SELECT * FROM folders ORDER BY id'),
    };
  }

  /**
   * 批量插入/更新照片（事务优化）
   * @param {Array} photos - 照片数组
   * @returns {number} 成功插入/更新的数量
   */
  batchUpsertPhotos(photos) {
    if (!photos || photos.length === 0) return 0;

    const insert = this.db.transaction((items) => {
      for (const photo of items) {
        this.stmts.upsertPhoto.run(this.#normalizePhoto(photo));
      }
      return items.length;
    });

    return insert(photos);
  }

  /**
   * 单条插入/更新照片
   */
  upsertPhoto(photo) {
    return this.stmts.upsertPhoto.run(this.#normalizePhoto(photo));
  }

  /**
   * 标准化照片数据
   */
  #normalizePhoto(input) {
    return {
      path: input.path,
      hash: input.hash || '',
      size: input.size || 0,
      width: input.width || 0,
      height: input.height || 0,
      created_at: input.created_at || Date.now(),
      shot_at: input.shot_at || null,
      updated_at: input.updated_at || Date.now(),
      thumbnail_status: input.thumbnail_status || 'pending',
      is_deleted: input.is_deleted ? 1 : 0,
      is_favorite: input.is_favorite ? 1 : 0,
      is_hidden: input.is_hidden ? 1 : 0,
      rating: input.rating || 0,
      tags_json: typeof input.tags_json === 'string' ? input.tags_json : JSON.stringify(input.tags || []),
      metadata_json: typeof input.metadata_json === 'string' ? input.metadata_json : JSON.stringify(input.metadata || {}),
      is_recipe_display: input.is_recipe_display ? 1 : 0,
    };
  }

  /**
   * 根据路径获取照片
   */
  getPhotoByPath(photoPath) {
    // 标准化路径格式，使用正斜杠
    const normalizedPath = photoPath.replace(/\\/g, '/');
    return this.stmts.getPhotoByPath.get(normalizedPath);
  }

  /**
   * 根据 hash 获取照片（用于去重）
   */
  getPhotoByHash(hash) {
    return this.stmts.getPhotoByHash.get(hash);
  }

  /**
   * 根据ID获取照片
   */
  getPhotoById(photoId) {
    return this.stmts.getPhotoById.get(photoId);
  }

  /**
   * 软删除照片
   */
  deletePhotoByPath(photoPath) {
    const normalizedPath = photoPath.replace(/\\/g, '/');
    return this.stmts.deletePhotoByPath.run(Date.now(), normalizedPath);
  }

  /**
   * 根据ID软删除照片
   */
  deletePhotoById(photoId) {
    return this.stmts.deletePhotoById.run(Date.now(), photoId);
  }
  
  /**
   * 硬删除照片
   */
  hardDeletePhotoByPath(photoPath) {
    const normalizedPath = photoPath.replace(/\\/g, '/');
    return this.stmts.hardDeletePhotoByPath.run(normalizedPath);
  }

  /**
   * 标记照片已删除
   */
  markPhotoDeleted(photoPath) {
    const normalizedPath = photoPath.replace(/\\/g, '/');
    return this.stmts.markPhotoDeleted.run(Date.now(), normalizedPath);
  }

  /**
   * 恢复已删除照片
   */
  restorePhoto(photoPath) {
    const normalizedPath = photoPath.replace(/\\/g, '/');
    return this.stmts.restorePhoto.run(Date.now(), normalizedPath);
  }

  /**
   * 更新缩略图状态
   */
  updateThumbnailStatus(photoPath, status) {
    const normalizedPath = photoPath.replace(/\\/g, '/');
    return this.stmts.updateThumbnailStatus.run(status, Date.now(), normalizedPath);
  }

  /**
   * 更新照片元数据
   */
  updatePhotoMetadata(photoPath, metadata) {
    const current = this.getPhotoByPath(photoPath);
    if (!current) return null;

    const normalizedPath = photoPath.replace(/\\/g, '/');
    return this.stmts.updatePhotoMetadata.run(
      metadata.is_favorite ?? current.is_favorite,
      metadata.is_hidden ?? current.is_hidden,
      metadata.rating ?? current.rating,
      typeof metadata.tags === 'object' ? JSON.stringify(metadata.tags) : current.tags_json,
      Date.now(),
      normalizedPath
    );
  }

  /**
   * 获取照片总数
   */
  countPhotos() {
    const row = this.stmts.countPhotos.get();
    return row?.total ?? 0;
  }

  /**
   * 按状态统计照片数
   */
  countPhotosByStatus() {
    return this.stmts.countPhotosByStatus.all();
  }

  /**
   * 分页获取照片
   */
  getPhotosPage(page = 1, pageSize = 120) {
    const safePage = Math.max(page, 1);
    const safeSize = Math.max(pageSize, 1);
    const offset = (safePage - 1) * safeSize;
    console.log(`[DB] Getting photos page ${safePage}, size ${safeSize}, offset ${offset}`);
    const photos = this.stmts.getPhotosPage.all(safeSize, offset);
    console.log(`[DB] Photos returned: ${photos.length}`);
    if (photos.length > 0) {
      console.log(`[DB] First photo:`, photos[0]);
      console.log(`[DB] First photo file extension:`, photos[0].path.split('.').pop());
    }
    return photos;
  }

  /**
   * 获取所有照片路径
   */
  getAllPaths() {
    return this.stmts.getAllPaths.all().map(row => row.path);
  }

  /**
   * 获取所有照片路径（包括软删除的）
   */
  getAllPathsIncludingDeleted() {
    return this.stmts.getAllPathsIncludingDeleted.all();
  }

  getPhotosByFolderPath(folderPath) {
    const normalizedPath = folderPath.replace(/\\/g, '/').toLowerCase();
    const allPhotos = this.db.prepare('SELECT id, path, hash, size, created_at FROM photos').all();
    return allPhotos.filter(p => p.path.replace(/\\/g, '/').toLowerCase().startsWith(normalizedPath + '/'));
  }

  getActivePhotosByFolderPath(folderPath) {
    const normalizedPath = folderPath.replace(/\\/g, '/').toLowerCase();
    const allPhotos = this.db.prepare('SELECT id, path, hash, size, created_at FROM photos WHERE is_deleted = 0').all();
    return allPhotos.filter(p => p.path.replace(/\\/g, '/').toLowerCase().startsWith(normalizedPath + '/'));
  }

  /**
   * 获取待生成缩略图的照片
   */
  getPendingThumbnails(limit = 100) {
    return this.stmts.getPendingThumbnails.all(limit);
  }

  /**
   * 更新扫描状态
   */
  updateScanStatus(folderPath, status) {
    return this.stmts.upsertScanStatus.run({
      folder_path: folderPath,
      last_scan_at: status.last_scan_at || Date.now(),
      total_files: status.total_files || 0,
      scanned_files: status.scanned_files || 0,
      status: status.status || 'idle',
    });
  }

  /**
   * 获取扫描状态
   */
  getScanStatus(folderPath) {
    return this.stmts.getScanStatus.get(folderPath);
  }

  /**
   * 获取所有扫描状态
   */
  getAllScanStatus() {
    return this.stmts.getAllScanStatus.all();
  }

  insertFolder(folder) {
    const now = Date.now();
    const result = this.stmts.insertFolder.run({
      name: folder.name,
      path: folder.path || null,
      parent_id: folder.parentId || null,
      include_subfolders: folder.includeSubfolders ? 1 : 0,
      photo_count: folder.photoCount || 0,
      last_synced: folder.lastSynced || null,
      created_at: now,
      updated_at: now,
    });
    return result.lastInsertRowid;
  }

  updateFolder(folder) {
    this.stmts.updateFolder.run({
      id: folder.id,
      name: folder.name,
      path: folder.path || null,
      parent_id: folder.parentId || null,
      include_subfolders: folder.includeSubfolders ? 1 : 0,
      photo_count: folder.photoCount || 0,
      last_synced: folder.lastSynced || null,
      updated_at: Date.now(),
    });
  }

  deleteFolder(folderId) {
    this.stmts.deleteFolder.run(folderId);
  }

  getFolderById(folderId) {
    return this.stmts.getFolderById.get(folderId);
  }

  getAllFolders() {
    console.log('[DB] getAllFolders called');
    const result = this.stmts.getAllFolders.all();
    console.log('[DB] getAllFolders result:', result);
    return result;
  }

  /**
   * 清理已删除的照片记录（物理删除）
   */
  cleanupDeletedPhotos() {
    const stmt = this.db.prepare('DELETE FROM photos WHERE is_deleted = 1');
    const result = stmt.run();
    return result.changes;
  }

  /**
   * 获取数据库统计信息
   */
  getStats() {
    const total = this.countPhotos();
    const byStatus = this.countPhotosByStatus();
    const deleted = this.db.prepare('SELECT COUNT(*) as count FROM photos WHERE is_deleted = 1').get();
    
    return {
      total,
      byStatus,
      deleted: deleted?.count || 0,
    };
  }

  /**
   * 获取所有标签
   */
  getAllTags() {
    const photos = this.db.prepare('SELECT tags_json FROM photos WHERE tags_json IS NOT NULL AND tags_json != "[]"').all();
    const tagSet = new Set();
    photos.forEach(photo => {
      try {
        const tags = JSON.parse(photo.tags_json);
        if (Array.isArray(tags)) {
          tags.forEach(tag => tagSet.add(tag));
        }
      } catch (e) {
        // ignore parse errors
      }
    });
    return Array.from(tagSet).sort();
  }

  /**
   * 获取所有相机型号
   */
  getAllCameraModels() {
    const photos = this.db.prepare(`SELECT DISTINCT json_extract(metadata_json, '$.cameraModel') as cameraModel FROM photos WHERE metadata_json IS NOT NULL`).all();
    return photos.map(p => p.cameraModel).filter(Boolean).sort();
  }

  /**
   * 获取所有胶片模拟
   */
  getAllFilmModes() {
    const photos = this.db.prepare(`SELECT DISTINCT json_extract(metadata_json, '$.filmMode') as filmMode FROM photos WHERE metadata_json IS NOT NULL`).all();
    return photos.map(p => p.filmMode).filter(Boolean).sort();
  }

  /**
   * 获取日期分组信息
   * 返回每个日期的照片数量
   */
  getDateGroups() {
    const photos = this.db.prepare(`
      SELECT 
        id, path, hash, thumbnail_status, created_at, shot_at, metadata_json,
        json_extract(metadata_json, '$.dateTime') as exifDateTime
      FROM photos 
      WHERE is_deleted = 0
    `).all();
    
    const groups = new Map();
    
    photos.forEach(photo => {
      let dateStr;
      try {
        let dateTime;
        if (photo.shot_at) {
          dateTime = new Date(photo.shot_at).toISOString();
        } else {
          const metadata = JSON.parse(photo.metadata_json || '{}');
          dateTime = metadata.dateTime || new Date(photo.created_at).toISOString();
        }
        const date = new Date(dateTime);
        dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch (e) {
        const date = photo.shot_at ? new Date(photo.shot_at) : new Date(photo.created_at);
        dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      
      if (!groups.has(dateStr)) {
        groups.set(dateStr, {
          date: dateStr,
          count: 0,
          photos: [],
          thumbnailReadyCount: 0,
        });
      }
      
      const group = groups.get(dateStr);
      group.count++;
      group.photos.push({
        id: photo.id,
        path: photo.path,
        hash: photo.hash,
        thumbnail_status: photo.thumbnail_status,
      });
      
      if (photo.thumbnail_status === 'ready') {
        group.thumbnailReadyCount++;
      }
    });
    
    return Array.from(groups.values()).sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }

  /**
   * 按日期获取照片
   * @param {string} dateStr - 日期字符串 (格式: "April 4, 2026")
   * @param {number} limit - 限制数量，0表示全部
   * @param {boolean} preferThumbnail - 是否优先返回有缩略图的照片
   */
  getPhotosByDate(dateStr, limit = 0, preferThumbnail = true) {
    const allPhotos = this.db.prepare(`
      SELECT id, path, hash, size, width, height, created_at, shot_at, updated_at,
             thumbnail_status, is_favorite, is_hidden, rating, tags_json, metadata_json
      FROM photos
      WHERE is_deleted = 0
    `).all();
    
    const matchedPhotos = allPhotos.filter(photo => {
      try {
        let dateTime;
        if (photo.shot_at) {
          dateTime = new Date(photo.shot_at).toISOString();
        } else {
          const metadata = JSON.parse(photo.metadata_json || '{}');
          dateTime = metadata.dateTime || new Date(photo.created_at).toISOString();
        }
        const photoDate = new Date(dateTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        return photoDate === dateStr;
      } catch (e) {
        const date = photo.shot_at ? new Date(photo.shot_at) : new Date(photo.created_at);
        const photoDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        return photoDate === dateStr;
      }
    });
    
    if (preferThumbnail) {
      matchedPhotos.sort((a, b) => {
        const aReady = a.thumbnail_status === 'ready' ? 0 : 1;
        const bReady = b.thumbnail_status === 'ready' ? 0 : 1;
        return aReady - bReady;
      });
    }
    
    if (limit > 0) {
      return matchedPhotos.slice(0, limit);
    }
    
    return matchedPhotos;
  }

  // ==================== 元数据映射配置操作 ====================

  getAllMappingConfigs() {
    return this.db.prepare('SELECT * FROM metadata_mapping_configs ORDER BY field_name').all();
  }

  getMappingConfigByField(fieldName) {
    return this.db.prepare('SELECT * FROM metadata_mapping_configs WHERE field_name = ?').get(fieldName);
  }

  upsertMappingConfig(fieldName, jsonPath, name = '') {
    const now = Date.now();
    const existing = this.getMappingConfigByField(fieldName);
    
    if (existing) {
      this.db.prepare(`
        UPDATE metadata_mapping_configs 
        SET json_path = ?, name = ?, updated_at = ?
        WHERE field_name = ?
      `).run(jsonPath, name, now, fieldName);
      return this.getMappingConfigByField(fieldName);
    } else {
      this.db.prepare(`
        INSERT INTO metadata_mapping_configs (name, field_name, json_path, is_enabled, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
      `).run(name || fieldName, fieldName, jsonPath, now, now);
      return this.getMappingConfigByField(fieldName);
    }
  }

  deleteMappingConfig(fieldName) {
    return this.db.prepare('DELETE FROM metadata_mapping_configs WHERE field_name = ?').run(fieldName);
  }

  getAllPresets() {
    return this.db.prepare('SELECT * FROM metadata_presets ORDER BY is_default DESC, name').all();
  }

  getPresetById(id) {
    return this.db.prepare('SELECT * FROM metadata_presets WHERE id = ?').get(id);
  }

  getDefaultPreset() {
    return this.db.prepare('SELECT * FROM metadata_presets WHERE is_default = 1').get();
  }

  upsertPreset(name, configJson, description = '', isDefault = false) {
    const now = Date.now();
    
    if (isDefault) {
      this.db.prepare('UPDATE metadata_presets SET is_default = 0').run();
    }
    
    const existing = this.db.prepare('SELECT * FROM metadata_presets WHERE name = ?').get(name);
    
    if (existing) {
      this.db.prepare(`
        UPDATE metadata_presets 
        SET description = ?, config_json = ?, is_default = ?, updated_at = ?
        WHERE name = ?
      `).run(description, JSON.stringify(configJson), isDefault ? 1 : 0, now, name);
      return this.db.prepare('SELECT * FROM metadata_presets WHERE name = ?').get(name);
    } else {
      this.db.prepare(`
        INSERT INTO metadata_presets (name, description, config_json, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(name, description, JSON.stringify(configJson), isDefault ? 1 : 0, now, now);
      return this.db.prepare('SELECT * FROM metadata_presets WHERE name = ?').get(name);
    }
  }

  deletePreset(id) {
    return this.db.prepare('DELETE FROM metadata_presets WHERE id = ?').run(id);
  }

  /**
   * 关闭数据库连接
   */
  close() {
    this.db.close();
  }
}

module.exports = { PhotoDatabase };