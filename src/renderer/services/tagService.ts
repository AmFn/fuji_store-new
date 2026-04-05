/**
 * 标签服务模块
 * 负责处理标签相关的业务逻辑，包括加载标签和从照片中移除标签
 */
import { Tag, Photo } from '../types';
import '../types/electronAPI';

export const tagService = {
  async loadAllTags() {
    try {
      console.log('[tagService] loadAllTags called');
      if (window.electronAPI?.getAllTags) {
        console.log('[tagService] Calling getAllTags API');
        const tags = await window.electronAPI.getAllTags();
        console.log('[tagService] getAllTags returned:', tags);
        const result = (tags || []).map((tag: any) => ({
          id: String(tag.id),
          name: tag.name,
          color: tag.color || '#3b82f6',
          ownerId: tag.owner_id || 'local'
        }));
        console.log('[tagService] Mapped tags:', result);
        return result;
      }
      console.log('[tagService] No electronAPI.getAllTags available');
      return [];
    } catch (error) {
      console.error('Failed to load tags:', error);
      return [];
    }
  },

  async createTag(tag: { name: string; color?: string; ownerId?: string }) {
    try {
      console.log('[tagService] createTag called with:', tag);
      if (window.electronAPI?.createTag) {
        const payload = {
          name: tag.name,
          color: tag.color || '#3b82f6',
          owner_id: tag.ownerId || 'local'
        };
        console.log('[tagService] Calling createTag API with:', payload);
        const result = await window.electronAPI.createTag(payload);
        console.log('[tagService] createTag API result:', result);
        if (result && result.id) {
          return {
            id: String(result.id),
            name: result.name || tag.name,
            color: result.color || tag.color || '#3b82f6',
            ownerId: result.owner_id || tag.ownerId || 'local'
          };
        }
        return null;
      }
      console.log('[tagService] No electronAPI.createTag available');
      return null;
    } catch (error) {
      console.error('Failed to create tag:', error);
      return null;
    }
  },

  async updateTag(tag: { id: string; name: string; color?: string }) {
    try {
      if (window.electronAPI?.updateTag) {
        await window.electronAPI.updateTag({
          id: Number(tag.id),
          name: tag.name,
          color: tag.color || '#3b82f6'
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update tag:', error);
      return false;
    }
  },

  async deleteTag(tagId: string) {
    try {
      if (window.electronAPI?.deleteTag) {
        await window.electronAPI.deleteTag(Number(tagId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete tag:', error);
      return false;
    }
  },

  async getTagsByPhoto(photoId: string) {
    try {
      console.log('[tagService] getTagsByPhoto called with:', photoId, typeof photoId);
      if (window.electronAPI?.getTagsByPhoto) {
        const numericPhotoId = Number(photoId);
        console.log('[tagService] Calling API with numeric ID:', numericPhotoId);
        const tags = await window.electronAPI.getTagsByPhoto(numericPhotoId);
        console.log('[tagService] API returned tags:', tags);
        return (tags || []).map((tag: any) => ({
          id: String(tag.id),
          name: tag.name,
          color: tag.color || '#3b82f6',
          ownerId: tag.owner_id || 'local'
        }));
      }
      console.log('[tagService] No electronAPI available');
      return [];
    } catch (error) {
      console.error('Failed to get tags by photo:', error);
      return [];
    }
  },

  async addTagToPhoto(photoId: string, tagId: string) {
    try {
      console.log('[tagService] addTagToPhoto called with:', { photoId, tagId });
      if (window.electronAPI?.addTagToPhoto) {
        const result = await window.electronAPI.addTagToPhoto(Number(photoId), Number(tagId));
        console.log('[tagService] addTagToPhoto API result:', result);
        return true;
      }
      console.log('[tagService] No electronAPI.addTagToPhoto available');
      return false;
    } catch (error) {
      console.error('Failed to add tag to photo:', error);
      return false;
    }
  },

  async removeTagFromPhoto(photoId: string, tagId: string) {
    try {
      if (window.electronAPI?.removeTagFromPhoto) {
        await window.electronAPI.removeTagFromPhoto(Number(photoId), Number(tagId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to remove tag from photo:', error);
      return false;
    }
  },

  async setPhotoTags(photoId: string, tagIds: string[]) {
    try {
      if (window.electronAPI?.setPhotoTags) {
        await window.electronAPI.setPhotoTags(Number(photoId), tagIds.map(Number));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to set photo tags:', error);
      return false;
    }
  },

  async removeTagFromAllPhotos(tagName: string, photos: Photo[]) {
    try {
      const tag = await this.getTagByName(tagName);
      if (!tag) return false;

      const affectedPhotos = photos.filter(p => (p.tags || []).includes(tagName));
      
      for (const photo of affectedPhotos) {
        const nextTags = (photo.tags || []).filter(t => t !== tagName);
        const tagIds = await Promise.all(
          nextTags.map(async (t) => {
            const foundTag = await this.getTagByName(t);
            return foundTag ? foundTag.id : null;
          })
        );
        await this.setPhotoTags(photo.id, tagIds.filter(Boolean) as string[]);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to remove tag from photos:', error);
      return false;
    }
  },

  async getTagByName(name: string) {
    try {
      console.log('[tagService] getTagByName called with:', name);
      if (window.electronAPI?.getTagByName) {
        const tag = await window.electronAPI.getTagByName(name);
        console.log('[tagService] getTagByName API returned:', tag);
        if (tag) {
          return {
            id: String(tag.id),
            name: tag.name,
            color: tag.color || '#3b82f6',
            ownerId: tag.owner_id || 'local'
          };
        }
      } else {
        console.log('[tagService] No electronAPI.getTagByName available');
      }
      return null;
    } catch (error) {
      console.error('Failed to get tag by name:', error);
      return null;
    }
  },

  async getOrCreateTag(tagName: string, ownerId: string = 'local') {
    try {
      console.log('[tagService] getOrCreateTag called with:', { tagName, ownerId });
      let tag = await this.getTagByName(tagName);
      console.log('[tagService] getTagByName returned:', tag);
      if (!tag) {
        console.log('[tagService] Tag not found, creating new tag');
        tag = await this.createTag({ name: tagName, ownerId });
        console.log('[tagService] createTag returned:', tag);
      }
      return tag;
    } catch (error) {
      console.error('Failed to get or create tag:', error);
      return null;
    }
  }
};
