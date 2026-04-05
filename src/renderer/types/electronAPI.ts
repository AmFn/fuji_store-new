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
      
      // 文件夹相关 v2
      'library:get-all-folders-v2': () => Promise<any[]>;
      'library:create-folder-v2': (folder: any) => Promise<any>;
      'library:update-folder-v2': (folder: any) => Promise<any>;
      'library:delete-folder-v2': (folderId: string) => Promise<any>;
      'library:assign-folder-by-path': (params: { folderId: string | number; folderPath: string; includeSubfolders?: boolean }) => Promise<{ assigned: number }>;
      
      // 标签相关
      getAllTags: () => Promise<string[]>;
      
      // 时间线相关
      getTimelineGroups: (page: number, pageSize: number) => Promise<{ items: any[]; total?: number; page?: number; totalPages?: number }>;
      getTimelinePhotosByDay: (dayKey: string, page: number, pageSize: number) => Promise<{ items: any[]; total?: number; page?: number; totalPages?: number }>;
      
      // 其他
      getThumbnailDir: () => Promise<string>;
      clearThumbnailCache: () => Promise<{ success: boolean; deleted?: number; error?: string }>;
      clearAllPhotos: () => Promise<any>;
      onLibraryUpdated: (listener: (payload: any) => void) => () => void;
    triggerLibraryUpdate: () => Promise<{ success: boolean }>;
    importFolder: (options: { folderPath: string; targetFolderId: string | null }) => Promise<any>;
    importFiles: (options: { files: string[]; targetFolderId: string | null }) => Promise<any[]>;
    };
  }
}

export {};
