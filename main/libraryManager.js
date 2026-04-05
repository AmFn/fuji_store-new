import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PhotoDatabase, normalizePath } from './db.js';
import { FileScanner } from './fileScanner.js';
import { FileWatcher } from './fileWatcher.js';
import { ThumbnailQueue } from './thumbnailQueue.js';

export class LibraryManager extends EventEmitter {
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
    super(); // 调用父类构造函数
    this.db = db;
    this.scanner = scanner;
    this.watcher = watcher;
    this.thumbnailQueue = thumbnailQueue;
    this.scanProgress = scanner.getProgress();
    this.libraryRoots = new Set();
  }

  async scanDirectory(dirPath, { watch = true, allowedFormats = null } = {}) {
    const root = normalizePath(dirPath);
    this.libraryRoots.add(root);

    const result = await this.scanner.scanDirectory(root, {
      recursive: true,
      allowedFormats,
      onProgress: async (progress) => {
        this.scanProgress = progress;
      },
      onBatchIndexed: async (rows) => {
        for (const row of rows) {
          if (row.thumbnail_status !== 'done' && row.deleted === 0) {
            await this.thumbnailQueue.enqueue(row.path, row.hash, { reason: 'scan' });
          }
        }
        this.emit('batch:upsert', { count: rows.length, paths: rows.map(row => row.path) });
      },
    });

    const physicalFolderId = await this.db.getPhysicalFolderIdByPath(root);
    if (physicalFolderId) {
      await this.db.assignFolderToPath(physicalFolderId, root, {
        includeSubfolders: true,
        onlyWhenUnassigned: true,
      });
    }

    if (watch) {
      await this.watcher.watchDirectory(root);
    }
    return result;
  }

  async scanDirectoryForNewFiles(dirPath) {
    const root = normalizePath(dirPath);
    const result = await this.scanner.scanDirectoryForNewFiles(root, {
      recursive: true
    });
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

  async assignFolderByPath(folderId, folderPath, includeSubfolders = true) {
    const assigned = await this.db.assignFolderToPath(folderId, folderPath, {
      includeSubfolders: Boolean(includeSubfolders),
      onlyWhenUnassigned: false,
    });
    return { assigned };
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

  async clearFolderPhotos(folderId) {
    return this.db.clearFolderPhotos(folderId);
  }

  async getAllTags() {
    console.log('[LibraryManager] getAllTags called');
    const tags = this.db.getAllTags();
    console.log('[LibraryManager] getAllTags returned:', tags);
    return tags;
  }

  async createTag(tag) {
    console.log('[LibraryManager] createTag called with:', tag);
    const id = await this.db.createTag(tag);
    console.log('[LibraryManager] createTag returned id:', id);
    return { 
      id, 
      name: tag.name,
      color: tag.color || '#3b82f6',
      owner_id: tag.owner_id || 'local'
    };
  }

  async updateTag(tag) {
    await this.db.updateTag(tag);
    return tag;
  }

  async deleteTag(tagId) {
    await this.db.deleteTag(tagId);
    return true;
  }

  async getTagById(tagId) {
    return this.db.getTagById(tagId);
  }

  async getTagByName(name) {
    return this.db.getTagByName(name);
  }

  async getTagsByPhotoId(photoId) {
    console.log('[LibraryManager] getTagsByPhotoId called with:', photoId);
    const tags = this.db.getTagsByPhotoId(photoId);
    console.log('[LibraryManager] getTagsByPhotoId returned:', tags);
    return tags;
  }

  async addTagToPhoto(photoId, tagId) {
    console.log('[LibraryManager] addTagToPhoto called with:', { photoId, tagId });
    const result = await this.db.addTagToPhoto(photoId, tagId);
    console.log('[LibraryManager] addTagToPhoto result:', result);
    return result;
  }

  async removeTagFromPhoto(photoId, tagId) {
    return this.db.removeTagFromPhoto(photoId, tagId);
  }

  async setPhotoTags(photoId, tagIds) {
    return this.db.setPhotoTags(photoId, tagIds);
  }

  async getPhotosByTagId(tagId, page, pageSize) {
    return this.db.getPhotosByTagId(tagId, page, pageSize);
  }

  async getAllRecipes() {
    return this.db.getAllRecipes();
  }

  async createRecipe(recipe) {
    const id = await this.db.createRecipe(recipe);
    return { ...recipe, id };
  }

  async updateRecipe(recipe) {
    await this.db.updateRecipe(recipe);
    return recipe;
  }

  async deleteRecipe(recipeId) {
    await this.db.deleteRecipe(recipeId);
    return true;
  }

  async getRecipeById(recipeId) {
    return this.db.getRecipeById(recipeId);
  }

  async getRecipesByPhotoId(photoId) {
    return this.db.getRecipesByPhotoId(photoId);
  }

  async addRecipeToPhoto(photoId, recipeId) {
    return this.db.addRecipeToPhoto(photoId, recipeId);
  }

  async removeRecipeFromPhoto(photoId, recipeId) {
    return this.db.removeRecipeFromPhoto(photoId, recipeId);
  }

  async setPhotoRecipe(photoId, recipeId) {
    return this.db.setPhotoRecipe(photoId, recipeId);
  }

  async getPhotosByRecipeId(recipeId, page, pageSize) {
    return this.db.getPhotosByRecipeId(recipeId, page, pageSize);
  }
}

export function registerLibraryIpc(ipcMain, manager) {
  ipcMain.handle('scanDirectory', async (_evt, targetPath, allowedFormats = null) => manager.scanDirectory(targetPath, { watch: true, allowedFormats }));
  ipcMain.handle('scanDirectoryForNewFiles', async (_evt, targetPath) => manager.scanDirectoryForNewFiles(targetPath));
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
  ipcMain.handle('library:assign-folder-by-path', async (_evt, { folderId, folderPath, includeSubfolders = true }) =>
    manager.assignFolderByPath(folderId, folderPath, includeSubfolders)
  );
  ipcMain.handle('clearAllPhotos', async () => manager.clearAllPhotos());

  ipcMain.handle('library:get-all-tags', async () => manager.getAllTags());
  ipcMain.handle('library:create-tag', async (_evt, tag) => manager.createTag(tag));
  ipcMain.handle('library:update-tag', async (_evt, tag) => manager.updateTag(tag));
  ipcMain.handle('library:delete-tag', async (_evt, tagId) => manager.deleteTag(tagId));
  ipcMain.handle('library:get-tag-by-id', async (_evt, tagId) => manager.getTagById(tagId));
  ipcMain.handle('library:get-tag-by-name', async (_evt, name) => manager.getTagByName(name));
  ipcMain.handle('library:get-tags-by-photo', async (_evt, photoId) => manager.getTagsByPhotoId(photoId));
  ipcMain.handle('library:add-tag-to-photo', async (_evt, photoId, tagId) => manager.addTagToPhoto(photoId, tagId));
  ipcMain.handle('library:remove-tag-from-photo', async (_evt, photoId, tagId) => manager.removeTagFromPhoto(photoId, tagId));
  ipcMain.handle('library:set-photo-tags', async (_evt, photoId, tagIds) => manager.setPhotoTags(photoId, tagIds));
  ipcMain.handle('library:get-photos-by-tag', async (_evt, tagId, page, pageSize) => manager.getPhotosByTagId(tagId, page, pageSize));

  ipcMain.handle('library:get-all-recipes', async () => manager.getAllRecipes());
  ipcMain.handle('library:create-recipe', async (_evt, recipe) => manager.createRecipe(recipe));
  ipcMain.handle('library:update-recipe', async (_evt, recipe) => manager.updateRecipe(recipe));
  ipcMain.handle('library:delete-recipe', async (_evt, recipeId) => manager.deleteRecipe(recipeId));
  ipcMain.handle('library:get-recipe-by-id', async (_evt, recipeId) => manager.getRecipeById(recipeId));
  ipcMain.handle('library:get-recipes-by-photo', async (_evt, photoId) => manager.getRecipesByPhotoId(photoId));
  ipcMain.handle('library:add-recipe-to-photo', async (_evt, photoId, recipeId) => manager.addRecipeToPhoto(photoId, recipeId));
  ipcMain.handle('library:remove-recipe-from-photo', async (_evt, photoId, recipeId) => manager.removeRecipeFromPhoto(photoId, recipeId));
  ipcMain.handle('library:set-photo-recipe', async (_evt, photoId, recipeId) => manager.setPhotoRecipe(photoId, recipeId));
  ipcMain.handle('library:get-photos-by-recipe', async (_evt, recipeId, page, pageSize) => manager.getPhotosByRecipeId(recipeId, page, pageSize));
}
