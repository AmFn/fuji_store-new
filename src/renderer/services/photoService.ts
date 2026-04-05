/**
 * 照片服务模块
 * 负责处理照片相关的业务逻辑，包括加载、更新和删除照片
 */
import { Photo } from '../types';
import { convertDbPhotoToPhoto } from '../utils/fileUtils';
import '../types/electronAPI';

// 本地存储键
const LOCAL_PHOTOS_KEY = 'fuji-local-photos';

// 模拟照片数据
const mockPhotos: Photo[] = [
  {
    id: '1',
    fileName: 'test-photo-1.jpg',
    filePath: 'test-photos/test-photo-1.jpg',
    thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo%20landscape&image_size=square',
    previewUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo%20landscape&image_size=square',
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
    thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo%20portrait&image_size=square',
    previewUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo%20portrait&image_size=square',
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
    thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo%20street&image_size=square',
    previewUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo%20street&image_size=square',
    hash: 'test3',
    cameraModel: 'FUJIFILM X-T4',
    dateTime: new Date(Date.now() - 259200000).toISOString(),
    filmMode: 'Classic Neg.',
    isFavorite: false,
    isHidden: false,
    rating: 3,
    tags: ['Street'],
    ownerId: 'local'
  },
  {
    id: '4',
    fileName: 'test-photo-4.jpg',
    filePath: 'test-photos/test-photo-4.jpg',
    thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo%20nature&image_size=square',
    previewUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo%20nature&image_size=square',
    hash: 'test4',
    cameraModel: 'FUJIFILM X-T4',
    dateTime: new Date(Date.now() - 345600000).toISOString(),
    filmMode: 'Velvia/Vivid',
    isFavorite: true,
    isHidden: false,
    rating: 4,
    tags: ['Nature'],
    ownerId: 'local'
  },
  {
    id: '5',
    fileName: 'test-photo-5.jpg',
    filePath: 'test-photos/test-photo-5.jpg',
    thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo%20architecture&image_size=square',
    previewUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo%20architecture&image_size=square',
    hash: 'test5',
    cameraModel: 'FUJIFILM X-T4',
    dateTime: new Date(Date.now() - 432000000).toISOString(),
    filmMode: 'Astia/Soft',
    isFavorite: false,
    isHidden: false,
    rating: 2,
    tags: ['Architecture'],
    ownerId: 'local'
  }
];

/**
 * 获取本地存储的照片
 */
const getLocalPhotos = (): Photo[] => {
  try {
    const stored = localStorage.getItem(LOCAL_PHOTOS_KEY);
    return stored ? JSON.parse(stored) : mockPhotos;
  } catch (error) {
    console.error('Failed to get local photos:', error);
    return mockPhotos;
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
 * 照片服务
 * 提供照片相关的操作方法
 */
export const photoService = {
  /**
   * 加载照片分页数据
   * @param page 页码
   * @param pageSize 每页大小
   * @param thumbnailDir 缩略图目录
   * @returns 包含照片列表和总页数的对象
   */
  async loadPhotosPage(page: number, pageSize: number, thumbnailDir: string | null) {
    try {
      if (window.electronAPI?.getPhotosPage) {
        const pageData = await window.electronAPI.getPhotosPage(page, pageSize);
        const items = (pageData?.items || []).map(p => convertDbPhotoToPhoto(p, thumbnailDir));
        
        return {
          items,
          totalPages: pageData?.totalPages || 1
        };
      } else {
        // 本地模式：从本地存储获取照片
        const photos = getLocalPhotos();
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const items = photos.slice(start, end);
        const totalPages = Math.ceil(photos.length / pageSize);
        
        return {
          items,
          totalPages
        };
      }
    } catch (error) {
      console.error('Failed to load photos page:', error);
      // 错误情况下返回模拟数据
      const photos = mockPhotos;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const items = photos.slice(start, end);
      const totalPages = Math.ceil(photos.length / pageSize);
      
      return {
        items,
        totalPages
      };
    }
  },

  /**
   * 更新照片信息
   * @param photo 照片对象
   * @param updates 更新内容
   * @returns 是否更新成功
   */
  async updatePhoto(photo: Photo, updates: Partial<Photo>) {
    try {
      if (window.electronAPI?.updatePhoto) {
        await window.electronAPI.updatePhoto(photo.filePath, updates);
        return true;
      } else {
        // 本地模式：更新本地存储中的照片
        const photos = getLocalPhotos();
        const updatedPhotos = photos.map(p => 
          p.id === photo.id ? { ...p, ...updates } : p
        );
        saveLocalPhotos(updatedPhotos);
        return true;
      }
    } catch (error) {
      console.error('Failed to update photo:', error);
      return false;
    }
  },

  /**
   * 删除照片
   * @param photoId 照片ID
   * @returns 是否删除成功
   */
  async deletePhoto(photoId: string) {
    try {
      if (window.electronAPI?.deletePhoto) {
        await window.electronAPI.deletePhoto(photoId);
        return true;
      } else {
        // 本地模式：从本地存储中删除照片
        const photos = getLocalPhotos();
        const updatedPhotos = photos.filter(p => p.id !== photoId);
        saveLocalPhotos(updatedPhotos);
        return true;
      }
    } catch (error) {
      console.error('Failed to delete photo:', error);
      return false;
    }
  }
};
