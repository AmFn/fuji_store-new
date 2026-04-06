const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;
let libraryManager;
let thumbnailCacheDir = '';
let configPath = '';
let recipePhotoDir = '';

function parseOptionalFolderId(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '' || rawValue === 'null') {
    return null;
  }
  const n = Number(rawValue);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeExifDateTime(exifValue) {
  if (!exifValue) return null;
  if (exifValue instanceof Date && !Number.isNaN(exifValue.getTime())) {
    return exifValue.toISOString();
  }
  const text = String(exifValue).trim();
  if (!text) return null;
  const normalized = text.replace(/^(\d{4}):(\d{2}):(\d{2})\s+/, '$1-$2-$3T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function loadConfig() {
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return {};
  }
}

async function saveConfig(config) {
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

async function getThumbnailCacheDir() {
  const config = await loadConfig();
  if (config.cacheDir) {
    return config.cacheDir;
  }
  return thumbnailCacheDir;
}

async function setThumbnailCacheDir(dir) {
  const config = await loadConfig();
  config.cacheDir = dir;
  await saveConfig(config);
  thumbnailCacheDir = dir;
  await fs.mkdir(dir, { recursive: true });
  return { success: true, cacheDir: dir };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
    backgroundColor: '#0f172a',
  });

  if (isDev) {
    // 开发服务器运行在3003端口（因为3000-3002端口被占用）
    mainWindow.loadURL('http://localhost:3003');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

function normalizePath(p) {
  const out = path.normalize(p).replace(/\\/g, '/');
  return process.platform === 'win32' ? out.toLowerCase() : out;
}

function quickHash(filePath, stats) {
  return crypto.createHash('sha1').update(`${filePath}|${stats.size}|${Math.floor(stats.mtimeMs)}`).digest('hex');
}

function getNestedValue(obj, pathText) {
  if (!obj || !pathText) return undefined;
  const keys = String(pathText).split('.');
  let current = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function applyValueMap(value, valueMap) {
  if (value === undefined || value === null || value === '' || !valueMap || typeof valueMap !== 'object') {
    return value;
  }
  const str = String(value);
  return valueMap[str] !== undefined ? valueMap[str] : value;
}

function resolveCombinedValue(metadata, field, configByKey) {
  if (!field?.isCombined || !Array.isArray(field.combinedFields) || field.combinedFields.length === 0) {
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
    value = applyValueMap(value, field.valueMap);
    if (value !== undefined && value !== null && value !== '') {
      extracted[field.key] = value;
    }
  }
  return { ...metadata, ...extracted };
}

async function scanFilesDirect(filePaths, targetFolderId) {
  if (!libraryManager) throw new Error('LibraryManager not initialized');
  const folderId = parseOptionalFolderId(targetFolderId);
  const rows = [];
  let metadataConfig = null;
  try {
    metadataConfig = await libraryManager.db.getMetadataFields();
  } catch (error) {
    metadataConfig = null;
    console.warn('[scanFilesDirect] Failed to load metadata fields, fallback to raw metadata:', error?.message || error);
  }
  let exiftool = null;
  try {
    const ExifTool = require('exiftool-vendored');
    exiftool = new ExifTool.ExifTool({ taskTimeoutMillis: 10000 });
  } catch {
    exiftool = null;
  }

  for (const fp of filePaths || []) {
    try {
      const st = await fs.stat(fp);
      let metadataJson = null;
      let dateTime = null;
      let normalizedFilmMode = null;
      let normalizedWhiteBalance = null;
      let normalizedDynamicRange = null;

      if (exiftool) {
        try {
          const rawMetadata = await exiftool.read(fp);
          const processedMetadata = rawMetadata ? applyFieldConfig(rawMetadata, metadataConfig) : null;
          metadataJson = processedMetadata ? JSON.stringify(processedMetadata) : null;
          normalizedFilmMode = processedMetadata?.filmSimulation || processedMetadata?.filmMode || processedMetadata?.FilmMode || null;
          normalizedWhiteBalance = processedMetadata?.whiteBalance || processedMetadata?.WhiteBalance || null;
          normalizedDynamicRange = processedMetadata?.dynamicRange || processedMetadata?.DynamicRange || null;
          dateTime =
            normalizeExifDateTime(processedMetadata?.DateTimeOriginal) ||
            normalizeExifDateTime(processedMetadata?.CreateDate) ||
            normalizeExifDateTime(processedMetadata?.FileModifyDate) ||
            null;
        } catch {
          metadataJson = null;
          dateTime = null;
        }
      }

      rows.push({
        path: normalizePath(fp),
        hash: quickHash(normalizePath(fp), st),
        folder_id: folderId,
        size: st.size,
        width: 0,
        height: 0,
        created_at: Math.floor(st.birthtimeMs || st.ctimeMs || st.mtimeMs),
        updated_at: Math.floor(st.mtimeMs),
        thumbnail_status: 'pending',
        deleted: 0,
        source_type: 'library',
        date_time: dateTime,
        metadata_json: metadataJson,
        film_mode: normalizedFilmMode ? String(normalizedFilmMode) : null,
        white_balance: normalizedWhiteBalance ? String(normalizedWhiteBalance) : null,
        dynamic_range: normalizedDynamicRange ? String(normalizedDynamicRange) : null,
      });
    } catch {
    }
  }

  if (exiftool) {
    try {
      await exiftool.end();
    } catch {
    }
  }

  if (rows.length > 0) {
    await libraryManager.db.upsertPhotosBatch(rows);
    for (const row of rows) {
      await libraryManager.thumbnailQueue.enqueue(row.path, row.hash, { reason: 'scan-files' });
    }
  }
  return { scanned: rows.length, failures: (filePaths || []).length - rows.length, total: (filePaths || []).length };
}

app.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Cache-Control': ['public, max-age=31536000'],
        },
      });
    });
  } catch {
  }

  const projectDir = process.cwd();
  const dbPath = path.join(projectDir, 'database', 'photos.db');
  configPath = path.join(projectDir, 'config.json');
  thumbnailCacheDir = path.join(projectDir, 'cache', 'thumbnails');
  recipePhotoDir = path.join(projectDir, 'cache', 'recipe-photos');
  
  const config = await loadConfig();
  if (config.cacheDir) {
    thumbnailCacheDir = config.cacheDir;
  }
  
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.mkdir(thumbnailCacheDir, { recursive: true });
  await fs.mkdir(recipePhotoDir, { recursive: true });

  const { LibraryManager, registerLibraryIpc } = await import('../../main/libraryManager.js');
  libraryManager = await LibraryManager.create({
    dbPath,
    thumbnailDir: thumbnailCacheDir,
  });
  registerLibraryIpc(ipcMain, libraryManager);

  // 监听FileWatcher的事件
  libraryManager.watcher.on('batch:upsert', (payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('library:updated', { type: 'watcher:upsert', ...payload });
  });
  libraryManager.watcher.on('batch:unlink', (payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('library:updated', { type: 'watcher:unlink', ...payload });
  });
  
  // 监听LibraryManager的事件（用于扫描操作）
  libraryManager.on('batch:upsert', (payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('library:updated', { type: 'scanner:upsert', ...payload });
  });
  libraryManager.thumbnailQueue.on('task:done', (payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('library:updated', { type: 'thumbnail:done', ...payload });
  });

  ipcMain.handle('dialog:pick-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '选择照片文件夹' });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:pick-files', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: '选择照片文件',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'raf'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths;
  });

  // Legacy channels mapped to new service.
  ipcMain.handle('library:scan-folder', async (_e, { folderPath, watch = true }) => {
    const result = await libraryManager.scanDirectory(folderPath, { watch });
    return { success: true, ...result };
  });
  ipcMain.handle('library:scan-files', async (_e, { filePaths, targetFolderId }) => {
    const result = await scanFilesDirect(filePaths, targetFolderId);
    return { success: true, ...result };
  });
  ipcMain.handle('library:get-photos', async (_e, { page = 1, pageSize = 120 }) => {
    const res = await libraryManager.getPhotos(page, pageSize);
    return res.items || [];
  });
  ipcMain.handle('library:get-photo-count', async () => {
    const res = await libraryManager.getPhotos(1, 1);
    return res.total || 0;
  });
  ipcMain.handle('library:get-scan-progress', async () => libraryManager.getScanProgress());
  ipcMain.handle('library:resync', async () => ({ success: true, ...(await libraryManager.resyncLibrary()) }));
  ipcMain.handle('library:get-watched-folders', async () => ({
    watchedPaths: libraryManager.watcher.getWatchedDirectories(),
  }));
  ipcMain.handle('library:get-thumbnail', async (_e, { photoPath, hash }) => {
    return libraryManager.getThumbnail(photoPath, hash);
  });
  ipcMain.handle('library:update-photo', async (_e, { photoPath, patch }) => {
    await libraryManager.db.updatePhotoMetadata(photoPath, patch || {});
    return { success: true };
  });
  ipcMain.handle('library:restore-photo', async (_e, { photoPath }) => {
    await libraryManager.db.restorePhotoByPath(photoPath);
    return { success: true };
  });
  ipcMain.handle('library:remove-photo', async (_e, { photoPath }) => {
    await libraryManager.db.markPhotoDeleted(photoPath);
    return { success: true };
  });
  ipcMain.handle('library:delete-photo', async (_e, { photoId }) => {
    await libraryManager.db.markPhotoDeletedById(photoId);
    return { success: true };
  });
  ipcMain.handle('library:show-in-folder', (_e, { photoPath }) => {
    shell.showItemInFolder(photoPath);
    return { success: true };
  });
  ipcMain.handle('library:get-status', async () => ({
    scan: libraryManager.getScanProgress(),
    watcher: { watchedPaths: libraryManager.watcher.getWatchedDirectories() },
    queue: libraryManager.thumbnailQueue.getStatus(),
  }));
  ipcMain.handle('app:get-thumbnail-dir', async () => getThumbnailCacheDir());
  ipcMain.handle('app:set-thumbnail-dir', async (_e, dir) => setThumbnailCacheDir(dir));
  ipcMain.handle('app:clear-thumbnail-cache', async () => {
    const cacheDir = await getThumbnailCacheDir();
    const files = await fs.readdir(cacheDir).catch(() => []);
    let deleted = 0;
    for (const n of files) {
      const full = path.join(cacheDir, n);
      try {
        const st = await fs.stat(full);
        if (st.isFile()) {
          await fs.unlink(full);
          deleted += 1;
        }
      } catch {
      }
    }
    return { success: true, deleted };
  });
  ipcMain.handle('library:get-all-cameras', async () => []);
  ipcMain.handle('library:get-all-film-modes', async () => []);
  ipcMain.handle('library:scan-for-new-files', async (_e, { folderPath }) => {
    const rows = await libraryManager.db.getPhotos(1, 100000, { sortBy: 'created_at', sortDirection: 'DESC' });
    const known = new Set((rows.items || []).map((r) => normalizePath(r.path)));
    const all = await fs.readdir(folderPath).catch(() => []);
    const newFiles = [];
    for (const n of all) {
      const fp = normalizePath(path.join(folderPath, n));
      if (!known.has(fp)) newFiles.push({ path: fp, fileName: n });
    }
    return { newFiles };
  });
  ipcMain.handle('library:scan-folder-all-files', async (_e, { folderPath }) => {
    const result = await libraryManager.scanDirectory(folderPath, { watch: false });
    return { allFiles: [], existingPaths: [], deletedPaths: [], ...result };
  });
  ipcMain.handle('library:get-date-groups', async () => {
    const g = await libraryManager.getTimelineGroups(1, 3650);
    return g.items;
  });
  ipcMain.handle('library:get-photos-by-date', async (_e, { dateStr, limit }) => {
    const r = await libraryManager.getTimelinePhotosByDay(dateStr, 1, limit || 120);
    return r.items;
  });
  ipcMain.handle('library:add-recipe-display-photos', async (_e, { recipeId, filePaths }) => {
    const safeRecipeId = Number(recipeId);
    if (!Number.isFinite(safeRecipeId)) {
      throw new Error('Invalid recipeId');
    }

    const inputs = Array.isArray(filePaths) ? filePaths : [];
    if (inputs.length === 0) {
      return { success: true, added: 0 };
    }

    await fs.mkdir(recipePhotoDir, { recursive: true });
    let added = 0;
    const now = Date.now();

    for (let i = 0; i < inputs.length; i += 1) {
      const sourcePath = inputs[i];
      try {
        const sourceStats = await fs.stat(sourcePath);
        if (!sourceStats.isFile()) continue;

        const ext = path.extname(sourcePath) || '.jpg';
        const baseHash = quickHash(normalizePath(sourcePath), sourceStats);
        const targetName = `${safeRecipeId}-${now}-${i}-${baseHash}${ext.toLowerCase()}`;
        const targetPath = normalizePath(path.join(recipePhotoDir, targetName));
        await fs.copyFile(sourcePath, targetPath);

        const targetStats = await fs.stat(targetPath);
        const targetHash = quickHash(targetPath, targetStats);
        await libraryManager.db.upsertPhoto({
          path: targetPath,
          hash: targetHash,
          size: targetStats.size,
          width: 0,
          height: 0,
          created_at: Math.floor(targetStats.birthtimeMs || targetStats.ctimeMs || targetStats.mtimeMs),
          updated_at: Math.floor(targetStats.mtimeMs),
          thumbnail_status: 'pending',
          deleted: 0,
          source_type: 'recipe_display',
        });

        const row = await libraryManager.db.getPhotoByPath(targetPath);
        if (!row?.id) continue;

        await libraryManager.db.addRecipeToPhoto(row.id, safeRecipeId);
        await libraryManager.thumbnailQueue.enqueue(targetPath, targetHash, { reason: 'recipe-display' });
        added += 1;
      } catch (error) {
        console.error('[Main] add recipe display photo failed:', sourcePath, error);
      }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('library:updated', { type: 'recipe:photos-updated', recipeId: safeRecipeId, added });
    }

    return { success: true, added };
  });
  ipcMain.handle('library:create-folder', async (_e, { folder }) => libraryManager.createFolder(folder));
  ipcMain.handle('library:update-folder', async (_e, { folder }) => libraryManager.updateFolder(folder));
  ipcMain.handle('library:delete-folder', async (_e, { folderId }) => libraryManager.deleteFolder(folderId));
  ipcMain.handle('library:clear-folder-photos', async (_e, { folderId }) => {
    await libraryManager.clearFolderPhotos(folderId);
    return { success: true };
  });
  ipcMain.handle('library:get-all-folders', async () => libraryManager.getAllFolders());
  ipcMain.handle('library:open-folder-path', async (_e, { folderPath }) => {
    const result = await shell.openPath(folderPath);
    return result ? { success: false, error: result } : { success: true };
  });
  
  // 触发库更新事件
  ipcMain.handle('library:trigger-update', async (_e) => {
    if (mainWindow) {
      mainWindow.webContents.send('library:updated', { type: 'manual:update' });
    }
    return { success: true };
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err) => {
  console.error('[Main] Fatal startup error:', err);
});

app.on('window-all-closed', async () => {
  if (libraryManager) await libraryManager.stop();
  if (process.platform !== 'darwin') app.quit();
});
