import path from 'node:path';
import { PhotoDatabase, normalizePath } from './db.js';
import { FileScanner } from './fileScanner.js';
import { FileWatcher } from './fileWatcher.js';
import { ThumbnailQueue } from './thumbnailQueue.js';

export class LibraryManager {
  static async create({
    dbPath = path.join(process.cwd(), 'database', 'photos.db'),
    thumbnailDir = path.join(process.cwd(), 'cache', 'thumbnails'),
  } = {}) {
    const db = await PhotoDatabase.create(dbPath);
    const thumbnailQueue = new ThumbnailQueue({
      db,
      cacheDir: thumbnailDir,
      concurrency: 4,
      retry: 2,
      quality: 82,
      maxEdge: 480,
    });
    await thumbnailQueue.init();

    const scanner = new FileScanner({
      db,
      batchSize: 300,
      idleStep: 200,
      hashStrategy: 'quick',
    });

    const watcher = new FileWatcher({
      db,
      thumbnailQueue,
      debounceMs: 250,
      dedupeWindowMs: 1200,
      flushIntervalMs: 600,
      batchSize: 200,
    });

    return new LibraryManager({ db, scanner, watcher, thumbnailQueue });
  }

  constructor({ db, scanner, watcher, thumbnailQueue }) {
    this.db = db;
    this.scanner = scanner;
    this.watcher = watcher;
    this.thumbnailQueue = thumbnailQueue;
    this.scanProgress = scanner.getProgress();
    this.libraryRoots = new Set();
  }

  async scanDirectory(dirPath, { watch = true } = {}) {
    const root = normalizePath(dirPath);
    this.libraryRoots.add(root);

    const result = await this.scanner.scanDirectory(root, {
      recursive: true,
      onProgress: async (progress) => {
        this.scanProgress = progress;
      },
      onBatchIndexed: async (rows) => {
        for (const row of rows) {
          if (row.thumbnail_status !== 'done' && row.deleted === 0) {
            await this.thumbnailQueue.enqueue(row.path, row.hash, { reason: 'scan' });
          }
        }
      },
    });

    if (watch) {
      await this.watcher.watchDirectory(root);
    }
    return result;
  }

  async getPhotos(page, pageSize) {
    return this.db.getPhotos(page, pageSize, {
      includeDeleted: false,
      sortBy: 'created_at',
      sortDirection: 'DESC',
    });
  }

  async getThumbnail(photoPath, hash) {
    let resolvedHash = hash;
    if (!resolvedHash) {
      const row = await this.db.getPhotoByPath(photoPath);
      resolvedHash = row?.hash;
    }
    if (!resolvedHash) {
      return { success: false, error: 'Photo hash not found' };
    }

    const result = await this.thumbnailQueue.ensureForPhoto({
      path: photoPath,
      hash: resolvedHash,
    });
    return {
      success: true,
      thumbnailPath: result.thumbnailPath,
      status: result.status,
    };
  }

  async getTimelineGroups(page = 1, pageSize = 90) {
    return this.db.getTimelineGroups(page, pageSize);
  }

  async getTimelinePhotosByDay(dayKey, page = 1, pageSize = 80) {
    return this.db.getTimelinePhotosByDay(dayKey, page, pageSize);
  }

  async createFolder(folder) {
    const id = await this.db.createFolder(folder);
    return { ...folder, id };
  }

  async updateFolder(folder) {
    await this.db.updateFolder(folder);
    return folder;
  }

  async deleteFolder(folderId) {
    await this.db.deleteFolder(folderId);
    return true;
  }

  async getAllFolders() {
    return this.db.getAllFolders();
  }

  getScanProgress() {
    return this.scanProgress;
  }

  async resyncLibrary() {
    const directories = [...this.libraryRoots];
    return this.watcher.resyncLibrary({
      directories,
      onProgress: async (progress) => {
        this.scanProgress = {
          ...this.scanProgress,
          status: 'resyncing',
          ...progress,
          finishedAt: null,
        };
      },
    });
  }

  async stop() {
    await this.watcher.stopAll();
    await this.thumbnailQueue.onIdle();
    this.db.close();
  }

  async clearAllPhotos() {
    return this.db.clearAllPhotos();
  }
}

export function registerLibraryIpc(ipcMain, manager) {
  ipcMain.handle('scanDirectory', async (_evt, targetPath) => manager.scanDirectory(targetPath, { watch: true }));
  ipcMain.handle('getPhotos', async (_evt, page, pageSize) => manager.getPhotos(page, pageSize));
  ipcMain.handle('getScanProgress', async () => manager.getScanProgress());
  ipcMain.handle('resyncLibrary', async () => manager.resyncLibrary());
  ipcMain.handle('getThumbnail', async (_evt, photoPath, hash) => manager.getThumbnail(photoPath, hash));
  ipcMain.handle('getTimelineGroups', async (_evt, page, pageSize) => manager.getTimelineGroups(page, pageSize));
  ipcMain.handle('getTimelinePhotosByDay', async (_evt, dayKey, page, pageSize) => manager.getTimelinePhotosByDay(dayKey, page, pageSize));
  ipcMain.handle('library:create-folder-v2', async (_evt, folder) => manager.createFolder(folder));
  ipcMain.handle('library:update-folder-v2', async (_evt, folder) => manager.updateFolder(folder));
  ipcMain.handle('library:delete-folder-v2', async (_evt, folderId) => manager.deleteFolder(folderId));
  ipcMain.handle('library:get-all-folders-v2', async () => manager.getAllFolders());
  ipcMain.handle('clearAllPhotos', async () => manager.clearAllPhotos());
}
