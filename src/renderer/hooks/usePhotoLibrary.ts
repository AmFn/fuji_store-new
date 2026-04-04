import { useState, useEffect } from 'react';

declare global {
  interface Window {
    electronAPI: {
      scanDirectory: (targetPath: string) => Promise<any>;
      getPhotosPage: (page: number, pageSize: number) => Promise<{ items: any[]; total?: number; page?: number; pageSize?: number; totalPages?: number }>;
      getScanProgressV2: () => Promise<any>;
      resyncLibraryV2: () => Promise<any>;
      getThumbnail: (photoPath: string, hash?: string) => Promise<{ success: boolean; thumbnailPath?: string; status?: string; error?: string }>;
      getTimelineGroups: (page: number, pageSize: number) => Promise<{ items: any[]; total?: number; page?: number; totalPages?: number }>;
      getTimelinePhotosByDay: (dayKey: string, page: number, pageSize: number) => Promise<{ items: any[]; total?: number; page?: number; totalPages?: number }>;
      openFolderPath: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      getPhotos: (page: number, pageSize: number) => Promise<any[]>;
      getPhotoCount: () => Promise<number>;
      getAllFolders: () => Promise<any[]>;
      getAllTags: () => Promise<string[]>;
      getAllCameras: () => Promise<string[]>;
      getAllFilmModes: () => Promise<string[]>;
      getDateGroups: () => Promise<any[]>;
      getPhotosByDate: (dateStr: string, limit?: number, preferThumbnail?: boolean) => Promise<any[]>;
      pickFolder: () => Promise<string | null>;
      pickFiles: () => Promise<string[] | null>;
      scanFolder: (folderPath: string, watch?: boolean) => Promise<any>;
      scanFiles: (filePaths: string[]) => Promise<any>;
      updatePhoto: (photoPath: string, patch: any) => Promise<any>;
      deletePhoto: (photoId: string) => Promise<any>;
      restorePhoto: (photoPath: string) => Promise<any>;
      showInFolder: (photoPath: string) => Promise<void>;
      getStatus: () => Promise<any>;
      getThumbnailDir: () => Promise<string>;
      clearThumbnailCache: () => Promise<{ success: boolean; deleted?: number; error?: string }>;
      getScanProgress: (folderPath: string) => Promise<any>;
      resyncLibrary: () => Promise<any>;
      getWatchedFolders: () => Promise<any[]>;
      scanForNewFiles: (folderPath: string) => Promise<any>;
      scanFolderAllFiles: (folderPath: string) => Promise<any>;
      createFolder: (folder: any) => Promise<any>;
      updateFolder: (folder: any) => Promise<any>;
      deleteFolder: (folderId: string) => Promise<any>;
      onLibraryUpdated: (listener: (payload: any) => void) => () => void;
    };
  }
}

export function usePhotoLibrary() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPhotos = async (page = 1, pageSize = 120) => {
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getPhotos(page, pageSize);
        return data || [];
      }
    } catch (err) {
      console.error('Failed to load photos:', err);
    }
    return [];
  };

  const loadFolders = async () => {
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getAllFolders();
        return data || [];
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
    return [];
  };

  const loadTags = async () => {
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getAllTags();
        return (data || []).map((name: string) => ({
          id: name,
          name,
          color: '#3b82f6',
          ownerId: 'local'
        }));
      }
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
    return [];
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [photosData, foldersData, tagsData] = await Promise.all([
        loadPhotos(),
        loadFolders(),
        loadTags()
      ]);
      setPhotos(photosData);
      setFolders(foldersData);
      setTags(tagsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();

    if (window.electronAPI?.onLibraryUpdated) {
      const unsubscribe = window.electronAPI.onLibraryUpdated(() => {
        loadAll();
      });
      return () => unsubscribe();
    }
  }, []);

  return {
    photos,
    setPhotos,
    folders,
    setFolders,
    tags,
    setTags,
    loading,
    error,
    reload: loadAll
  };
}

