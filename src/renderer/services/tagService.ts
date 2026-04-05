/**
 * 标签服务模块
 * 负责处理标签相关的业务逻辑，包括加载标签和从照片中移除标签
 */
import { Tag, Photo } from '../types';
import '../types/electronAPI';

// 本地存储键
const LOCAL_TAGS_KEY = 'fuji-local-tags';
const LOCAL_PHOTOS_KEY = 'fuji-local-photos';

// 模拟标签数据
const mockTags: Tag[] = [
  {
    id: 'Portrait',
    name: 'Portrait',
    color: '#3b82f6',
    ownerId: 'local'
  },
  {
    id: 'Street',
    name: 'Street',
    color: '#10b981',
    ownerId: 'local'
  },
  {
    id: 'Nature',
    name: 'Nature',
    color: '#f59e0b',
    ownerId: 'local'
  },
  {
    id: 'Architecture',
    name: 'Architecture',
    color: '#ef4444',
    ownerId: 'local'
  }
];

/**
 * 获取本地存储的标签
 */
const getLocalTags = (): Tag[] => {
  try {
    const stored = localStorage.getItem(LOCAL_TAGS_KEY);
    return stored ? JSON.parse(stored) : mockTags;
  } catch (error) {
    console.error('Failed to get local tags:', error);
    return mockTags;
  }
};

/**
 * 保存标签到本地存储
 */
const saveLocalTags = (tags: Tag[]): void => {
  try {
    localStorage.setItem(LOCAL_TAGS_KEY, JSON.stringify(tags));
  } catch (error) {
    console.error('Failed to save local tags:', error);
  }
};

/**
 * 获取本地存储的照片
 */
const getLocalPhotos = (): Photo[] => {
  try {
    const stored = localStorage.getItem(LOCAL_PHOTOS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to get local photos:', error);
    return [];
  }
};

/**
 * 保存照片到本地存储
 */
const saveLocalPhotos = (photos: Photo[]): void => {
  try {
    localStorage.setItem(LOCAL_PHOTOS_KEY, JSON.stringify(photos));
  } catch (error) {
    console.error('Failed to save local photos:', error);
  }
};

/**
 * 标签服务
 * 提供标签相关的操作方法
 */
export const tagService = {
  /**
   * 加载所有标签
   * @returns 标签列表
   */
  async loadAllTags() {
    try {
      if (window.electronAPI?.getAllTags) {
        const tagsData = await window.electronAPI.getAllTags();
        return (tagsData || []).map((name: string) => ({
          id: name,
          name,
          color: '#3b82f6',
          ownerId: 'local'
        }));
      } else {
        // 本地模式：从本地存储获取标签
        return getLocalTags();
      }
    } catch (error) {
      console.error('Failed to load tags:', error);
      // 错误情况下返回模拟数据
      return mockTags;
    }
  },

  /**
   * 从所有照片中移除标签
   * @param tagName 标签名称
   * @param photos 照片列表
   * @returns 是否移除成功
   */
  async removeTagFromAllPhotos(tagName: string, photos: Photo[]) {
    try {
      if (window.electronAPI?.updatePhoto) {
        const affectedPhotos = photos.filter(p => (p.tags || []).includes(tagName));
        
        for (const photo of affectedPhotos) {
          const nextTags = (photo.tags || []).filter(t => t !== tagName);
          await window.electronAPI.updatePhoto(photo.filePath, { tags: nextTags });
        }
        
        return true;
      } else {
        // 本地模式：从本地存储中移除标签
        const localPhotos = getLocalPhotos();
        const updatedPhotos = localPhotos.map(photo => ({
          ...photo,
          tags: (photo.tags || []).filter(t => t !== tagName)
        }));
        saveLocalPhotos(updatedPhotos);
        
        // 从标签列表中移除标签
        const tags = getLocalTags();
        const updatedTags = tags.filter(tag => tag.name !== tagName);
        saveLocalTags(updatedTags);
        
        return true;
      }
    } catch (error) {
      console.error('Failed to remove tag from photos:', error);
      return false;
    }
  }
};
