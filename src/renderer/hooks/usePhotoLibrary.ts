/**
 * 照片库自定义Hook
 * 用于管理照片库的状态和数据加载
 */
import { useState, useEffect } from 'react';
import { photoService } from '../services/photoService';
import { folderService } from '../services/folderService';
import { tagService } from '../services/tagService';
import { Photo, Folder, Tag } from '../types';
import '../types/electronAPI';
import { PLACEHOLDER_IMAGE } from '../constants/assets';


/**
 * 照片库Hook
 * 提供照片、文件夹和标签的状态管理和数据加载功能
 * @returns 照片库状态和操作方法
 */
export function usePhotoLibrary() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [thumbnailDir, setThumbnailDir] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootProgress, setBootProgress] = useState({
    phase: 'init',
    total: 0,
    completed: 0,
    failed: 0,
    percent: 0,
    text: '准备中...'
  });

  const dedupeFolders = (items: Folder[]) => {
    const seen = new Set<string>();
    return items.filter((folder) => {
      const key = `${folder.type}|${(folder.path || '').toLowerCase()}|${folder.parentId || 'root'}|${folder.name.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const toFileUrl = (inputPath: string): string => {
    const normalized = (inputPath || '').replace(/\\/g, '/');
    if (!normalized) return '';
    if (normalized.startsWith('file://')) return normalized;
    if (/^[A-Za-z]:\//.test(normalized)) {
      return `file:///${encodeURI(normalized)}`;
    }
    if (normalized.startsWith('/')) {
      return `file://${encodeURI(normalized)}`;
    }
    return `file:///${encodeURI(normalized)}`;
  };

  const preloadThumbnails = async (inputPhotos: Photo[], concurrency = 6): Promise<Photo[]> => {
    if (!window.electronAPI?.getThumbnail || inputPhotos.length === 0) return inputPhotos;

    const total = inputPhotos.length;
    let completed = 0;
    let failed = 0;
    let pointer = 0;
    const output = [...inputPhotos];

    setBootProgress({
      phase: 'thumbnails',
      total,
      completed: 0,
      failed: 0,
      percent: 0,
      text: `正在预加载缩略图 (0/${total})`
    });

    const worker = async () => {
      while (true) {
        const index = pointer;
        pointer += 1;
        if (index >= total) break;

        const photo = output[index];
        try {
          const res = await window.electronAPI.getThumbnail(photo.filePath, photo.hash);
          if (res?.success && res.thumbnailPath) {
            const nextThumb = toFileUrl(res.thumbnailPath);
            output[index] = {
              ...photo,
              thumbnailUrl: nextThumb,
              previewUrl: photo.fileName.toLowerCase().endsWith('.raf') ? nextThumb : photo.previewUrl
            };
          } else {
            failed += 1;
          }
        } catch {
          failed += 1;
        } finally {
          completed += 1;
          const percent = total > 0 ? Math.round((completed / total) * 100) : 100;
          setBootProgress({
            phase: 'thumbnails',
            total,
            completed,
            failed,
            percent,
            text: `正在预加载缩略图 (${completed}/${total})`
          });
        }
      }
    };

    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, total)) }, () => worker());
    await Promise.all(workers);
    return output;
  };

  /**
   * 加载缩略图目录
   * @returns 缩略图目录路径
   */
  const loadThumbnailDir = async () => {
    try {
      if (window.electronAPI) {
        const dir = await window.electronAPI.getThumbnailDir();
        console.log('Loaded thumbnail directory:', dir);
        setThumbnailDir(dir);
        return dir;
      }
    } catch (err) {
      console.error('Failed to load thumbnail directory:', err);
    }
    return null;
  };

  /**
   * 确保存在未分类目录
   */
  const ensureUncategorizedFolder = async () => {
    if (window.electronAPI) {
      const folders = await folderService.loadAllFolders();
      const hasUncategorized = folders.some(folder => folder.name === '未分类');
      if (!hasUncategorized) {
        const uncategorizedFolder = {
          name: '未分类',
          parentId: null,
          path: null,
          type: 'logical',
          ownerId: 'local',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          photoCount: 0
        };
        await window.electronAPI.createFolder(uncategorizedFolder);
        return uncategorizedFolder;
      }
    }
    return null;
  };

  /**
   * 加载所有数据
   * 包括照片、文件夹和标签
   */
  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      if (window.electronAPI) {
        setBootProgress({
          phase: 'bootstrap',
          total: 4,
          completed: 0,
          failed: 0,
          percent: 0,
          text: '初始化目录与配置...'
        });

        // 确保存在未分类目录
        await ensureUncategorizedFolder();
        setBootProgress(prev => ({ ...prev, completed: 1, percent: 25, text: '读取缓存目录...' }));
        
        const thumbDir = await loadThumbnailDir();
        setBootProgress(prev => ({ ...prev, completed: 2, percent: 50, text: '读取文件夹和标签...' }));
        const [foldersData, tagsData] = await Promise.all([
          folderService.loadAllFolders(),
          tagService.loadAllTags()
        ]);
        
        // 加载第一页照片
        const photosData = await photoService.loadPhotosPage(1, 120, thumbDir);
        setBootProgress(prev => ({ ...prev, completed: 3, percent: 75, text: '整理照片数据...' }));
        
        // 确保照片有有效的thumbnailUrl
        const processedPhotos = photosData.items.map(photo => {
          if (!photo.thumbnailUrl || photo.thumbnailUrl === 'file:///') {
            return {
              ...photo,
              thumbnailUrl: PLACEHOLDER_IMAGE,
              previewUrl: PLACEHOLDER_IMAGE
            };
          }
          return photo;
        });

        const hydratedPhotos = await preloadThumbnails(processedPhotos, 6);
        
        setPhotos(hydratedPhotos);
        setFolders(dedupeFolders(foldersData));
        setTags(tagsData);
        setBootProgress({
          phase: 'done',
          total: 1,
          completed: 1,
          failed: 0,
          percent: 100,
          text: '加载完成'
        });
      } else {
        setPhotos([
          {
            id: '1',
            fileName: 'test-photo-1.jpg',
            filePath: 'test-photos/test-photo-1.jpg',
            thumbnailUrl: PLACEHOLDER_IMAGE,
            previewUrl: PLACEHOLDER_IMAGE,
            hash: 'test1',
            cameraModel: 'FUJIFILM X-T4',
            dateTime: new Date(Date.now() - 86400000).toISOString(),
            filmMode: 'Classic Chrome',
            isFavorite: false,
            isHidden: false,
            rating: 0,
            tags: [],
            ownerId: 'local'
          },
          {
            id: '2',
            fileName: 'test-photo-2.jpg',
            filePath: 'test-photos/test-photo-2.jpg',
            thumbnailUrl: PLACEHOLDER_IMAGE,
            previewUrl: PLACEHOLDER_IMAGE,
            hash: 'test2',
            cameraModel: 'FUJIFILM X-T4',
            dateTime: new Date(Date.now() - 172800000).toISOString(),
            filmMode: 'Provia/Standard',
            isFavorite: true,
            isHidden: false,
            rating: 5,
            tags: ['Portrait'],
            ownerId: 'local'
          },
          {
            id: '3',
            fileName: 'test-photo-3.jpg',
            filePath: 'test-photos/test-photo-3.jpg',
            thumbnailUrl: PLACEHOLDER_IMAGE,
            previewUrl: PLACEHOLDER_IMAGE,
            hash: 'test3',
            cameraModel: 'FUJIFILM X-T4',
            dateTime: new Date(Date.now() - 259200000).toISOString(),
            filmMode: 'Classic Neg.',
            isFavorite: false,
            isHidden: false,
            rating: 3,
            tags: ['Street'],
            ownerId: 'local'
          }
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setPhotos([
        {
          id: '1',
          fileName: 'test-photo-1.jpg',
          filePath: 'test-photos/test-photo-1.jpg',
          thumbnailUrl: PLACEHOLDER_IMAGE,
          previewUrl: PLACEHOLDER_IMAGE,
          hash: 'test1',
          cameraModel: 'FUJIFILM X-T4',
          dateTime: new Date(Date.now() - 86400000).toISOString(),
          filmMode: 'Classic Chrome',
          isFavorite: false,
          isHidden: false,
          rating: 0,
          tags: [],
          ownerId: 'local'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    loadAll();

    // 监听库更新事件
    if (window.electronAPI?.onLibraryUpdated) {
      const unsubscribe = window.electronAPI.onLibraryUpdated(() => {
        loadAll();
      });
      return () => unsubscribe();
    }
  }, []);

  return {
    photos,           // 照片列表
    setPhotos,        // 设置照片列表
    folders,          // 文件夹列表
    setFolders,       // 设置文件夹列表
    tags,             // 标签列表
    setTags,          // 设置标签列表
    thumbnailDir,     // 缩略图目录
    loading,          // 加载状态
    error,            // 错误信息
    bootProgress,     // 启动加载进度
    reload: loadAll   // 重新加载数据的方法
  };
}

