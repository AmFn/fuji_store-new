import { Photo, Folder } from '../types';

/**
 * Normalizes a file system path by replacing backslashes with forward slashes and converting to lowercase
 */
export function normalizeFsPath(input: string): string {
  return (input || '').replace(/\\/g, '/').toLowerCase();
}

function toFileUrl(inputPath: string): string {
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
}

/**
 * Checks if a photo is in a given folder
 */
export function isPhotoInFolder(photo: Photo, folder?: Folder | null): boolean {
  if (!folder) return true;
  if (folder.type === 'physical' && folder.path) {
    const photoPath = normalizeFsPath(photo.filePath || '');
    const folderPath = normalizeFsPath(folder.path || '');
    if (!folderPath) return false;
    if (folder.includeSubfolders) {
        return photoPath === folderPath || photoPath.startsWith(`${folderPath}/`);
    }
    const photoDir = photoPath.split('/').slice(0, -1).join('/');
    return photoDir === folderPath;
  }
  if (photo.folderId) {
    return String(photo.folderId) === String(folder.id);
  }
  return folder.name === '未分类';
}

/**
 * Converts a database photo object to a Photo type
 */
export function convertDbPhotoToPhoto(dbPhoto: any, thumbDir?: string | null): Photo {
  if (!dbPhoto || !dbPhoto.path) {
    return {
      id: 'invalid',
      fileName: 'Invalid Photo',
      filePath: '',
      thumbnailUrl: '',
      previewUrl: '',
      hash: '',
      cameraModel: '',
      dateTime: new Date().toISOString(),
      filmMode: '',
      isFavorite: false,
      isHidden: false,
      rating: 0,
      tags: [],
      ownerId: 'local'
    };
  }

  const pathParts = dbPhoto.path.split(/[\\/]/);
  const fileName = pathParts[pathParts.length - 1];

  let thumbnailUrl = '';
  let previewUrl = '';

  // 检查是否在Electron环境中
  const isElectron = typeof window !== 'undefined' && window.electronAPI;

  if (dbPhoto.thumbnail_status === 'done' && dbPhoto.hash && typeof thumbDir === 'string') {
    if (isElectron) {
      thumbnailUrl = toFileUrl(`${thumbDir.replace(/\\/g, '/')}/${dbPhoto.hash}_thumb.jpg`);
      previewUrl = toFileUrl(dbPhoto.path);
    } else {
      // 在Web环境中，使用占位图片
      thumbnailUrl = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo&image_size=square`;
      previewUrl = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo&image_size=square`;
    }
  } else {
    if (isElectron && dbPhoto.path) {
      previewUrl = toFileUrl(dbPhoto.path);
      thumbnailUrl = toFileUrl(dbPhoto.path);
    } else {
      // 在Web环境中，使用占位图片
      thumbnailUrl = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo&image_size=square`;
      previewUrl = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fuji%20camera%20photo&image_size=square`;
    }
  }

  return {
    id: String(dbPhoto.id || Math.random()),
    fileName: fileName,
    filePath: dbPhoto.path,
    thumbnailUrl,
    previewUrl,
    hash: dbPhoto.hash || '',
    cameraModel: dbPhoto.camera_model || '',
    dateTime: dbPhoto.created_at ? new Date(dbPhoto.created_at).toISOString() : new Date().toISOString(),
    filmMode: dbPhoto.film_mode || '',
    isFavorite: false,
    isHidden: false,
    rating: 0,
    tags: [],
    ownerId: 'local',
    // 富士相机参数
    dynamicRange: dbPhoto.dynamic_range || '',
    colorChrome: dbPhoto.color_chrome || '',
    colorChromeBlue: dbPhoto.color_chrome_blue || '',
    colorChromeRed: dbPhoto.color_chrome_red || '',
    grainEffect: dbPhoto.grain_effect || '',
    grainEffectRough: dbPhoto.grain_effect_rough || '',
    highlightTone: dbPhoto.highlight_tone || '',
    shadowTone: dbPhoto.shadow_tone || '',
    tone: dbPhoto.tone || '',
    color: dbPhoto.color || '',
    sharpness: dbPhoto.sharpness || '',
    clarity: dbPhoto.clarity || '',
    noiseReduction: dbPhoto.noise_reduction || '',
    highISONoiseReduction: dbPhoto.high_iso_noise_reduction || '',
    iso: dbPhoto.iso || 0,
    aperture: dbPhoto.aperture || 0,
    shutterSpeed: dbPhoto.shutter_speed || '',
    exposureCompensation: dbPhoto.exposure_compensation || 0,
    exposureMode: dbPhoto.exposure_mode || '',
    meteringMode: dbPhoto.metering_mode || '',
    whiteBalance: dbPhoto.white_balance || '',
    whiteBalanceMode: dbPhoto.white_balance_mode || '',
    whiteBalanceTemperature: dbPhoto.white_balance_temperature || 0,
    whiteBalanceTint: dbPhoto.white_balance_tint || 0,
    focusMode: dbPhoto.focus_mode || '',
    focusArea: dbPhoto.focus_area || '',
    afPoint: dbPhoto.af_point || '',
    flashFired: dbPhoto.flash_fired || 0,
    flashMode: dbPhoto.flash_mode || '',
    lensModel: dbPhoto.lens_model || '',
    lensMake: dbPhoto.lens_make || '',
    focalLength: dbPhoto.focal_length || 0,
    focalLength35mm: dbPhoto.focal_length_35mm || 0,
    location: dbPhoto.location || '',
    folderId: dbPhoto.folder_id != null ? String(dbPhoto.folder_id) : undefined
  };
}

/**
 * Converts a database folder object to a Folder type
 */
export function convertDbFolderToFolder(dbFolder: any): Folder {
  const folderPath = dbFolder.path || '';
  const folderType = dbFolder.folder_type || dbFolder.type || (folderPath ? 'physical' : 'logical');
  const includeSubfolders = dbFolder.include_subfolders ?? dbFolder.includeSubfolders ?? true;
  const photoCount = dbFolder.photo_count ?? dbFolder.photoCount ?? 0;
  const lastSynced = dbFolder.last_synced ?? dbFolder.lastSynced ?? null;
  const parentId = dbFolder.parent_id ?? dbFolder.parentId ?? null;

  return {
    id: String(dbFolder.id),
    name: dbFolder.name,
    path: folderPath,
    type: folderType,
    includeSubfolders: Boolean(includeSubfolders),
    photoCount: Number(photoCount),
    lastSynced: lastSynced ? new Date(lastSynced).toISOString() : '',
    parentId: parentId ? String(parentId) : undefined
  };
}
