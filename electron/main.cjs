const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('node:path');
const { mkdirSync, existsSync } = require('node:fs');
const { PhotoService } = require('./photoService.cjs');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;
let photoService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
    backgroundColor: '#0f172a',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // 配置 session 启用磁盘缓存
  try {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Cache-Control': ['public, max-age=31536000'],
        },
      });
    });
  } catch (err) {
    console.warn('[Main] Failed to configure session:', err.message);
  }

  const projectDir = process.cwd();
  const dbPath = path.join(projectDir, 'database', 'photos.db');
  const thumbnailCacheDir = path.join(projectDir, 'cache', 'thumbnails');
  mkdirSync(path.dirname(dbPath), { recursive: true });
  mkdirSync(thumbnailCacheDir, { recursive: true });

  // 初始化照片服务
  photoService = new PhotoService({
    dbPath,
    cacheDir: thumbnailCacheDir,
    onLibraryUpdated: (payload) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('library:updated', payload);
    },
  });

  // 启动时处理待生成的缩略图
  photoService.thumbnailQueue.processPendingFromDB(1000).then((result) => {
    console.log('[Main] Thumbnail processing result:', result);
  }).catch((err) => {
    console.error('[Main] Thumbnail processing error:', err);
  });

  // IPC 接口
  
  // 选择文件夹对话框
  ipcMain.handle('dialog:pick-folder', async () => {
    const result = await dialog.showOpenDialog({ 
      properties: ['openDirectory'],
      title: '选择照片文件夹',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // 选择文件对话框
  ipcMain.handle('dialog:pick-files', async () => {
    const result = await dialog.showOpenDialog({ 
      properties: ['openFile', 'multiSelections'],
      title: '选择照片文件',
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'raw', 'cr2', 'nef', 'arw', 'dng', 'raf'] }
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths;
  });

  // 扫描文件夹
  ipcMain.handle('library:scan-folder', async (_event, { folderPath, watch = true }) => {
    try {
      const result = await photoService.scanFolder(folderPath, watch);
      
      // 保存文件夹到数据库
      const folderName = folderPath.split(/[\\/]/).pop() || folderPath;
      try {
        photoService.db.insertFolder({
          name: folderName,
          path: folderPath,
          parentId: null,
          includeSubfolders: true,
          photoCount: result.scanned || 0,
          lastSynced: Date.now(),
        });
      } catch (e) {
        console.error('Failed to save folder to DB:', e);
      }
      
      return { success: true, ...result };
    } catch (err) {
      console.error('[Main] Scan failed:', err);
      return { success: false, error: err.message };
    }
  });

  // 扫描文件列表
  ipcMain.handle('library:scan-files', async (_event, { filePaths }) => {
    try {
      const result = await photoService.scanFiles(filePaths);
      return { success: true, ...result };
    } catch (err) {
      console.error('[Main] Scan files failed:', err);
      return { success: false, error: err.message };
    }
  });

  // 获取照片列表（分页）
  ipcMain.handle('library:get-photos', (_event, { page = 1, pageSize = 120 }) => {
    console.log(`[Main] Getting photos page ${page}, size ${pageSize}`);
    const photos = photoService.getPhotos(page, pageSize);
    console.log(`[Main] Photos returned: ${photos.length}`);
    if (photos.length > 0) {
      console.log(`[Main] First photo:`, photos[0]);
    }
    return photos;
  });

  // 获取照片总数
  ipcMain.handle('library:get-photo-count', () => {
    return photoService.getPhotoCount();
  });

  // 获取扫描进度
  ipcMain.handle('library:get-scan-progress', (_event, folderPath) => {
    return photoService.getScanProgress(folderPath);
  });

  // 重新同步库
  ipcMain.handle('library:resync', async () => {
    try {
      const result = await photoService.resyncLibrary();
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取监听的文件夹
  ipcMain.handle('library:get-watched-folders', () => {
    return photoService.getWatchedFolders();
  });

  // 更新照片元数据
  ipcMain.handle('library:update-photo', (_event, { photoPath, patch }) => {
    return photoService.updatePhoto(photoPath, patch);
  });

  // 恢复软删除的照片
  ipcMain.handle('library:restore-photo', (_event, { photoPath }) => {
    photoService.db.restorePhoto(photoPath);
    return { success: true };
  });

  // 删除照片
  ipcMain.handle('library:remove-photo', (_event, { photoPath }) => {
    photoService.removePhoto(photoPath);
    return { success: true };
  });

  // 根据ID删除照片
  ipcMain.handle('library:delete-photo', async (_event, { photoId }) => {
    try {
      await photoService.deletePhoto(photoId);
      return { success: true };
    } catch (err) {
      console.error('[Main] Delete photo failed:', err);
      return { success: false, error: err.message };
    }
  });

  // 在文件夹中显示
  ipcMain.handle('library:show-in-folder', (_event, { photoPath }) => {
    photoService.showInFolder(photoPath);
    return { success: true };
  });

  // 获取服务状态
  ipcMain.handle('library:get-status', () => {
    return photoService.getStatus();
  });

  // 获取缩略图缓存目录
  ipcMain.handle('app:get-thumbnail-dir', () => {
    return thumbnailCacheDir;
  });

  // 获取所有标签
  ipcMain.handle('library:get-all-tags', () => {
    return photoService.db.getAllTags();
  });

  // 获取所有相机型号
  ipcMain.handle('library:get-all-cameras', () => {
    return photoService.db.getAllCameraModels();
  });

  // 获取所有胶片模拟
  ipcMain.handle('library:get-all-film-modes', () => {
    return photoService.db.getAllFilmModes();
  });

  // 扫描文件夹获取新文件
  ipcMain.handle('library:scan-for-new-files', async (_event, { folderPath }) => {
    const result = await photoService.scanFolderForNewFiles(folderPath);
    return result;
  });

  // 扫描文件夹获取所有文件（包括已存在的）
  ipcMain.handle('library:scan-folder-all-files', async (_event, { folderPath }) => {
    console.log('[Main] scanFolderAllFiles called with:', folderPath);
    try {
      const result = await photoService.scanFolderAllFiles(folderPath);
      console.log('[Main] scanFolderAllFiles result:', result);
      return result;
    } catch (err) {
      console.error('[Main] scanFolderAllFiles error:', err);
      throw err;
    }
  });

  // 获取日期分组信息
  ipcMain.handle('library:get-date-groups', () => {
    return photoService.getDateGroups();
  });

  // 按日期获取照片
  ipcMain.handle('library:get-photos-by-date', (_event, { dateStr, limit, preferThumbnail }) => {
    return photoService.getPhotosByDate(dateStr, limit, preferThumbnail);
  });

  // 创建文件夹
  ipcMain.handle('library:create-folder', (_event, { folder }) => {
    const id = photoService.db.insertFolder(folder);
    return { ...folder, id };
  });

  // 更新文件夹
  ipcMain.handle('library:update-folder', (_event, { folder }) => {
    photoService.db.updateFolder(folder);
    return folder;
  });

  // 删除文件夹
  ipcMain.handle('library:delete-folder', (_event, { folderId }) => {
    photoService.db.deleteFolder(folderId);
    return true;
  });

  // 获取所有文件夹
  ipcMain.handle('library:get-all-folders', () => {
    try {
      return photoService.db.getAllFolders();
    } catch (err) {
      console.error('Error getting all folders:', err);
      return [];
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  // 停止照片服务
  if (photoService) {
    await photoService.stop();
  }
  
  if (process.platform !== 'darwin') app.quit();
});
