const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;
let libraryManager;
let thumbnailCacheDir = '';

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

async function scanFilesDirect(filePaths, targetFolderId) {
  if (!libraryManager) throw new Error('LibraryManager not initialized');
  const parsedFolderId = Number(targetFolderId);
  const folderId = Number.isFinite(parsedFolderId) ? parsedFolderId : null;
  const rows = [];
  for (const fp of filePaths || []) {
    try {
      const st = await fs.stat(fp);
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
      });
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
  thumbnailCacheDir = path.join(projectDir, 'cache', 'thumbnails');
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.mkdir(thumbnailCacheDir, { recursive: true });

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
  ipcMain.handle('app:get-thumbnail-dir', async () => thumbnailCacheDir);
  ipcMain.handle('app:clear-thumbnail-cache', async () => {
    const files = await fs.readdir(thumbnailCacheDir).catch(() => []);
    let deleted = 0;
    for (const n of files) {
      const full = path.join(thumbnailCacheDir, n);
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
