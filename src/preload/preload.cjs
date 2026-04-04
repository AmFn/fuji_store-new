const { contextBridge, ipcRenderer } = require('electron');

/**
 * Electron Preload 脚本
 * 暴露安全的 API 给渲染进程
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // 标准 IPC（新）
  scanDirectory: (targetPath) => ipcRenderer.invoke('scanDirectory', targetPath),
  getPhotosPage: (page, pageSize) =>
    ipcRenderer.invoke('getPhotos', page, pageSize).catch(async () => {
      const items = await ipcRenderer.invoke('library:get-photos', { page, pageSize });
      return { page, pageSize, total: items.length, totalPages: 1, items };
    }),
  getScanProgressV2: () =>
    ipcRenderer.invoke('getScanProgress').catch(() => ipcRenderer.invoke('library:get-scan-progress', '')),
  resyncLibraryV2: () =>
    ipcRenderer.invoke('resyncLibrary').catch(() => ipcRenderer.invoke('library:resync')),
  getThumbnail: (photoPath, hash) =>
    ipcRenderer.invoke('library:get-thumbnail', { photoPath, hash }).catch(() => ({
      success: true,
      thumbnailPath: photoPath,
      status: 'done',
    })),
  getTimelineGroups: (page, pageSize) =>
    ipcRenderer.invoke('getTimelineGroups', page, pageSize).catch(async () => {
      const groups = await ipcRenderer.invoke('library:get-date-groups');
      const start = (Math.max(1, page) - 1) * Math.max(1, pageSize);
      const items = (groups || []).slice(start, start + pageSize).map((g) => ({
        day_key: new Date(g.date).toISOString().slice(0, 10),
        latest_created_at: Date.now(),
        photo_count: g.count || 0,
      }));
      return {
        page,
        pageSize,
        total: (groups || []).length,
        totalPages: Math.ceil((groups || []).length / Math.max(1, pageSize)),
        items,
      };
    }),
  getTimelinePhotosByDay: (dayKey, page, pageSize) =>
    ipcRenderer.invoke('getTimelinePhotosByDay', dayKey, page, pageSize).catch(async () => {
      const items = await ipcRenderer.invoke('library:get-photos-by-date', { dateStr: dayKey, limit: pageSize, preferThumbnail: false });
      return {
        dayKey,
        page,
        pageSize,
        total: (items || []).length,
        totalPages: 1,
        items: items || [],
      };
    }),
  openFolderPath: (folderPath) => ipcRenderer.invoke('library:open-folder-path', { folderPath }),

  // 文件夹选择对话框
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),

  // 文件选择对话框
  pickFiles: () => ipcRenderer.invoke('dialog:pick-files'),

  // 扫描文件夹
  scanFolder: (folderPath, watch = true) =>
    ipcRenderer.invoke('scanDirectory', folderPath).catch(() =>
      ipcRenderer.invoke('library:scan-folder', { folderPath, watch })
    ),

  // 扫描文件列表
  scanFiles: (filePaths) => 
    ipcRenderer.invoke('library:scan-files', { filePaths }),

  // 获取照片列表（分页）
  getPhotos: async (page, pageSize) => {
    try {
      const result = await ipcRenderer.invoke('getPhotos', page, pageSize);
      return result?.items || [];
    } catch {
      return ipcRenderer.invoke('library:get-photos', { page, pageSize });
    }
  },

  // 获取照片总数
  getPhotoCount: () => ipcRenderer.invoke('library:get-photo-count'),

  // 获取扫描进度
  getScanProgress: (folderPath) =>
    ipcRenderer.invoke('getScanProgress').catch(() =>
      ipcRenderer.invoke('library:get-scan-progress', folderPath)
    ),

  // 重新同步库
  resyncLibrary: () => ipcRenderer.invoke('resyncLibrary').catch(() => ipcRenderer.invoke('library:resync')),

  // 获取监听的文件夹
  getWatchedFolders: () => ipcRenderer.invoke('library:get-watched-folders'),

  // 更新照片元数据
  updatePhoto: (photoPath, patch) => 
    ipcRenderer.invoke('library:update-photo', { photoPath, patch }),

  // 恢复软删除的照片
  restorePhoto: (photoPath) => 
    ipcRenderer.invoke('library:restore-photo', { photoPath }),

  // 删除照片
  removePhoto: (photoPath) => 
    ipcRenderer.invoke('library:remove-photo', { photoPath }),

  // 根据ID删除照片
  deletePhoto: (photoId) => 
    ipcRenderer.invoke('library:delete-photo', { photoId }),

  // 在文件夹中显示
  showInFolder: (photoPath) => 
    ipcRenderer.invoke('library:show-in-folder', { photoPath }),

  // 获取服务状态
  getStatus: () => ipcRenderer.invoke('library:get-status'),

  // 监听库更新事件
  onLibraryUpdated: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('library:updated', wrapped);
    
    // 返回取消订阅函数
    return () => {
      ipcRenderer.removeListener('library:updated', wrapped);
    };
  },

  // 获取缩略图缓存目录
  getThumbnailDir: () => ipcRenderer.invoke('app:get-thumbnail-dir'),
  clearThumbnailCache: () => ipcRenderer.invoke('app:clear-thumbnail-cache'),

  // 获取所有标签
  getAllTags: () => ipcRenderer.invoke('library:get-all-tags'),

  // 获取所有相机型号
  getAllCameras: () => ipcRenderer.invoke('library:get-all-cameras'),

  // 获取所有胶片模拟
  getAllFilmModes: () => ipcRenderer.invoke('library:get-all-film-modes'),

  // 扫描文件夹获取新文件
  scanForNewFiles: (folderPath) => 
    ipcRenderer.invoke('library:scan-for-new-files', { folderPath }),

  // 扫描文件夹获取所有文件
  scanFolderAllFiles: (folderPath) => {
    console.log('[Preload] scanFolderAllFiles called with:', folderPath);
    return ipcRenderer.invoke('library:scan-folder-all-files', { folderPath });
  },

  // 获取日期分组信息
  getDateGroups: () => ipcRenderer.invoke('library:get-date-groups'),

  // 按日期获取照片
  getPhotosByDate: (dateStr, limit, preferThumbnail) => 
    ipcRenderer.invoke('library:get-photos-by-date', { dateStr, limit, preferThumbnail }),

  // 创建文件夹
  createFolder: (folder) =>
    ipcRenderer.invoke('library:create-folder-v2', folder).catch(() =>
      ipcRenderer.invoke('library:create-folder', { folder })
    ),

  // 更新文件夹
  updateFolder: (folder) =>
    ipcRenderer.invoke('library:update-folder-v2', folder).catch(() =>
      ipcRenderer.invoke('library:update-folder', { folder })
    ),

  // 删除文件夹
  deleteFolder: (folderId) =>
    ipcRenderer.invoke('library:delete-folder-v2', folderId).catch(() =>
      ipcRenderer.invoke('library:delete-folder', { folderId })
    ),

  // 获取所有文件夹
  getAllFolders: () =>
    ipcRenderer.invoke('library:get-all-folders-v2').catch(() =>
      ipcRenderer.invoke('library:get-all-folders').catch(err => {
        console.error('getAllFolders error:', err);
        return [];
      })
    ),
});
