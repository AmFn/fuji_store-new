/**
 * 时间线自定义Hook
 * 用于管理时间线的状态和数据加载
 */
import { useState, useEffect } from 'react';
import { Photo } from '../types';
import { convertDbPhotoToPhoto } from '../utils/fileUtils';
import '../types/electronAPI';

// Mock Photos for local mode
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
 * 时间线Hook
 * 提供时间线照片的状态管理和数据加载功能
 * @returns 时间线状态和操作方法
 */
export function useTimeline() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载时间线数据
   * 包括按天分组的照片
   */
  const loadTimeline = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (window.electronAPI?.getTimelineGroups && window.electronAPI?.getTimelinePhotosByDay) {
        const dayGroups: any[] = [];
        let page = 1;
        
        while (true) {
          const groupsRes = await window.electronAPI.getTimelineGroups(page, 90);
          const items = groupsRes?.items || [];
          dayGroups.push(...items);
          
          const totalPages = groupsRes?.totalPages || page;
          if (page >= totalPages || items.length === 0) break;
          
          page += 1;
          if (page > 200) break;
        }

        const allTimelinePhotos: Photo[] = [];
        
        for (const group of dayGroups) {
          const dayKey = group.day_key;
          if (!dayKey) continue;
          
          let dayPage = 1;
          
          while (true) {
            const dayRes = await window.electronAPI.getTimelinePhotosByDay(dayKey, dayPage, 120);
            const rows = (dayRes?.items || []).map(p => convertDbPhotoToPhoto(p, null));
            allTimelinePhotos.push(...rows);
            
            const totalPages = dayRes?.totalPages || dayPage;
            if (dayPage >= totalPages || rows.length === 0) break;
            
            dayPage += 1;
            if (dayPage > 200) break;
          }
        }

        setPhotos(allTimelinePhotos);
      } else {
        // Use mock data if electronAPI is not available
        setPhotos(mockPhotos);
      }
    } catch (err) {
      console.error('Failed to load timeline:', err);
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
      // Use mock data in case of error
      setPhotos(mockPhotos);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载时间线数据
  useEffect(() => {
    loadTimeline();
  }, []);

  return {
    photos,           // 时间线照片列表
    loading,          // 加载状态
    error,            // 错误信息
    reload: loadTimeline   // 重新加载数据的方法
  };
}
