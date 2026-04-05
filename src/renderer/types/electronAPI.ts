/**
 * Electron API 类型定义
 */
declare global {
  interface Window {
    electronAPI: {
      // 照片相关
      getPhotosPage: (page: number, pageSize: number) => Promise<{ items: any[]; total?: number; page?: number; pageSize?: number; totalPages?: number }>;
      updatePhoto: (photoPath: string, patch: any) => Promise<any>;
      deletePhoto: (photoId: string) => Promise<any>;
      
      // 文件夹相关
      getAllFolders: () => Promise<any[]>;
      createFolder: (folder: any) => Promise<any>;
      updateFolder: (folder: any) => Promise<any>;
      deleteFolder: (folderId: string) => Promise<any>;
      clearFolderPhotos: (folderId: string) => Promise<{ success: boolean }>;
      assignFolderByPath: (folderId: string | number, folderPath: string, includeSubfolders?: boolean) => Promise<{ assigned: number }>;
      openFolderPath: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      showInFolder: (photoPath: string) => Promise<any>;
      
      // 文件夹相关 v2
      'library:get-all-folders-v2': () => Promise<any[]>;
      'library:create-folder-v2': (folder: any) => Promise<any>;
      'library:update-folder-v2': (folder: any) => Promise<any>;
      'library:delete-folder-v2': (folderId: string) => Promise<any>;
      'library:assign-folder-by-path': (params: { folderId: string | number; folderPath: string; includeSubfolders?: boolean }) => Promise<{ assigned: number }>;
      
      // 标签相关
      getAllTags: () => Promise<any[]>;
      createTag: (tag: { name: string; color?: string; owner_id?: string }) => Promise<any>;
      updateTag: (tag: { id: number; name: string; color?: string }) => Promise<number>;
      deleteTag: (tagId: number) => Promise<number>;
      getTagById: (tagId: number) => Promise<any | null>;
      getTagByName: (name: string) => Promise<any | null>;
      getTagsByPhoto: (photoId: number) => Promise<any[]>;
      addTagToPhoto: (photoId: number, tagId: number) => Promise<number>;
      removeTagFromPhoto: (photoId: number, tagId: number) => Promise<number>;
      setPhotoTags: (photoId: number, tagIds: number[]) => Promise<number>;
      getPhotosByTag: (tagId: number, page?: number, pageSize?: number) => Promise<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }>;
      
      // 配方相关
      getAllRecipes: () => Promise<any[]>;
      createRecipe: (recipe: any) => Promise<any>;
      updateRecipe: (recipe: any) => Promise<number>;
      deleteRecipe: (recipeId: number) => Promise<number>;
      getRecipeById: (recipeId: number) => Promise<any | null>;
      getRecipesByPhoto: (photoId: number) => Promise<any[]>;
      addRecipeToPhoto: (photoId: number, recipeId: number) => Promise<number>;
      removeRecipeFromPhoto: (photoId: number, recipeId: number) => Promise<number>;
      setPhotoRecipe: (photoId: number, recipeId: number | null) => Promise<boolean>;
      getPhotosByRecipe: (recipeId: number, page?: number, pageSize?: number) => Promise<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }>;
      addRecipeDisplayPhotos: (recipeId: number, filePaths: string[]) => Promise<{ success: boolean; added: number }>;
      
      // 时间线相关
      getTimelineGroups: (page: number, pageSize: number) => Promise<{ items: any[]; total?: number; page?: number; totalPages?: number }>;
      getTimelinePhotosByDay: (dayKey: string, page: number, pageSize: number) => Promise<{ items: any[]; total?: number; page?: number; totalPages?: number }>;
      
      // 文件选择
      pickFolder: () => Promise<string | null>;
      pickFiles: () => Promise<string[] | null>;
      
      // 扫描相关
      scanDirectoryForNewFiles: (folderPath: string) => Promise<{ newFiles: { path: string; fileName: string }[] }>;
      scanFiles: (filePaths: string[]) => Promise<any>;
      
      // AI 识别
      recognizeRecipe: (photo: any) => Promise<any>;
      
      // 其他
      getThumbnailDir: () => Promise<string>;
      setThumbnailDir: (dir: string) => Promise<{ success: boolean; cacheDir: string }>;
      clearThumbnailCache: () => Promise<{ success: boolean; deleted?: number; error?: string }>;
      clearAllPhotos: () => Promise<any>;
      onLibraryUpdated: (listener: (payload: any) => void) => () => void;
    triggerLibraryUpdate: () => Promise<{ success: boolean }>;
    importFolder: (options: { folderPath: string; targetFolderId: string | null; allowedFormats?: string[] | null }) => Promise<any>;
    importFiles: (options: { files: string[]; targetFolderId: string | null }) => Promise<any[]>;
    };
  }
}

export {};
