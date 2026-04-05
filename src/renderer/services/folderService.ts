/**
 * 文件夹服务模块
 * 负责处理文件夹相关的业务逻辑，包括加载、创建、更新和删除文件夹
 */
import { Folder } from '../types';
import { convertDbFolderToFolder } from '../utils/fileUtils';
import '../types/electronAPI';

// 本地存储键
const LOCAL_FOLDERS_KEY = 'fuji-local-folders';

// 模拟文件夹数据
const mockFolders: Folder[] = [
  {
    id: '1',
    name: 'My Photos',
    parentId: null,
    path: null,
    type: 'logical',
    includeSubfolders: true,
    photoCount: 5,
    lastSynced: Date.now().toString()
  },
  {
    id: '2',
    name: 'Portraits',
    parentId: '1',
    path: null,
    type: 'logical',
    includeSubfolders: false,
    photoCount: 1,
    lastSynced: Date.now().toString()
  },
  {
    id: '3',
    name: 'Landscapes',
    parentId: '1',
    path: null,
    type: 'logical',
    includeSubfolders: false,
    photoCount: 1,
    lastSynced: Date.now().toString()
  }
];

/**
 * 获取本地存储的文件夹
 */
const getLocalFolders = (): Folder[] => {
  try {
    const stored = localStorage.getItem(LOCAL_FOLDERS_KEY);
    return stored ? JSON.parse(stored) : mockFolders;
  } catch (error) {
    console.error('Failed to get local folders:', error);
    return mockFolders;
  }
};

/**
 * 保存文件夹到本地存储
 */
const saveLocalFolders = (folders: Folder[]): void => {
  try {
    localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(folders));
  } catch (error) {
    console.error('Failed to save local folders:', error);
  }
};

/**
 * 生成唯一ID
 */
const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

/**
 * 文件夹服务
 * 提供文件夹相关的操作方法
 */
export const folderService = {
  /**
   * 加载所有文件夹
   * @returns 文件夹列表
   */
  async loadAllFolders() {
    try {
      if (window.electronAPI?.getAllFolders) {
        const foldersData = await window.electronAPI.getAllFolders();
        return (foldersData || []).map(convertDbFolderToFolder);
      } else {
        // 本地模式：从本地存储获取文件夹
        return getLocalFolders();
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
      // 错误情况下返回模拟数据
      return mockFolders;
    }
  },

  /**
   * 创建文件夹
   * @param folderData 文件夹数据
   * @param folderData.name 文件夹名称
   * @param folderData.parentId 父文件夹ID
   * @param folderData.path 文件夹路径
   * @param folderData.type 文件夹类型
   * @returns 创建的文件夹对象
   */
  async createFolder(folderData: {
    name: string;
    parentId: string;
    path: string | null;
    type: 'physical' | 'logical';
  }) {
    try {
      if (window.electronAPI?.createFolder) {
        const created = await window.electronAPI.createFolder({
          ...folderData,
          includeSubfolders: true,
          photoCount: 0,
          lastSynced: Date.now(),
        });
        
        return convertDbFolderToFolder(created);
      } else {
        // 本地模式：创建文件夹并保存到本地存储
        const folders = getLocalFolders();
        const newFolder: Folder = {
          id: generateId(),
          name: folderData.name,
          parentId: folderData.parentId,
          path: folderData.path,
          type: folderData.type,
          includeSubfolders: true,
          photoCount: 0,
          lastSynced: Date.now().toString()
        };
        const updatedFolders = [...folders, newFolder];
        saveLocalFolders(updatedFolders);
        return newFolder;
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      return null;
    }
  },

  /**
   * 更新文件夹
   * @param folderId 文件夹ID
   * @param updates 更新内容
   * @returns 是否更新成功
   */
  async updateFolder(folderId: string, updates: Partial<Folder>) {
    try {
      if (window.electronAPI?.updateFolder) {
        await window.electronAPI.updateFolder({ id: folderId, ...updates });
        return true;
      } else {
        // 本地模式：更新本地存储中的文件夹
        const folders = getLocalFolders();
        const updatedFolders = folders.map(folder => 
          folder.id === folderId ? { ...folder, ...updates } : folder
        );
        saveLocalFolders(updatedFolders);
        return true;
      }
    } catch (error) {
      console.error('Failed to update folder:', error);
      return false;
    }
  },

  /**
   * 删除文件夹
   * @param folderId 文件夹ID
   * @returns 是否删除成功
   */
  async deleteFolder(folderId: string) {
    try {
      if (window.electronAPI?.deleteFolder) {
        await window.electronAPI.deleteFolder(folderId);
        return true;
      } else {
        // 本地模式：从本地存储中删除文件夹
        const folders = getLocalFolders();
        const updatedFolders = folders.filter(folder => folder.id !== folderId);
        saveLocalFolders(updatedFolders);
        return true;
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
      return false;
    }
  }
};
