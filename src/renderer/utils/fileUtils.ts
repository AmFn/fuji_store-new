import { Photo, Folder } from '../types';
import { PLACEHOLDER_IMAGE } from '../constants/assets';

function parseDbDateTime(dateStr: any): string | null {
  if (dateStr === null || dateStr === undefined || dateStr === '') return null;
  if (typeof dateStr === 'number' && Number.isFinite(dateStr)) {
    const ts = dateStr > 1e12 ? dateStr : dateStr * 1000;
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const str = String(dateStr);
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    if (Number.isFinite(num)) {
      const ts = num > 1e12 ? num : num * 1000;
      const d = new Date(ts);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  const normalized = str.replace(/^(\d{4}):(\d{2}):(\d{2})\s+/, '$1-$2-$3T');
  const parsed = new Date(normalized);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

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

function readMetadataValue(metadata: Record<string, any>, keys: string[]): any {
  for (const key of keys) {
    const value = metadata?.[key];
    if (value !== undefined && value !== null && value !== '') {
      if (value && typeof value === 'object') {
        if (value.rawValue !== undefined) return value.rawValue;
        if (value.value !== undefined) return value.value;
      }
      return value;
    }
  }
  return undefined;
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
  console.log('[convertDbPhotoToPhoto] raw dbPhoto.tags:', dbPhoto?.tags, 'type:', typeof dbPhoto?.tags);
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
      isRecipeDisplay: false,
      rating: 0,
      tags: dbPhoto.tags || [],
      ownerId: 'local'
    };
  }

  const pathParts = dbPhoto.path.split(/[\\/]/);
  const fileName = pathParts[pathParts.length - 1];

  let thumbnailUrl = '';
  let previewUrl = '';

  // 检查是否在Electron环境中
  const isElectron = typeof window !== 'undefined' && window.electronAPI;

  if (dbPhoto.thumbnail_status === 'done' && dbPhoto.hash) {
    if (isElectron && typeof thumbDir === 'string') {
      thumbnailUrl = toFileUrl(`${thumbDir.replace(/\\/g, '/')}/${dbPhoto.hash}.jpg`);
      // 对于 RAF 文件，使用缩略图作为预览，因为浏览器无法直接显示 RAF 文件
      if (fileName.toLowerCase().endsWith('.raf')) {
        previewUrl = thumbnailUrl;
      } else {
        previewUrl = toFileUrl(dbPhoto.path);
      }
    } else if (isElectron && dbPhoto.path) {
      previewUrl = toFileUrl(dbPhoto.path);
      thumbnailUrl = toFileUrl(dbPhoto.path);
    } else {
      thumbnailUrl = PLACEHOLDER_IMAGE;
      previewUrl = PLACEHOLDER_IMAGE;
    }
  } else {
    if (isElectron && dbPhoto.path) {
      previewUrl = toFileUrl(dbPhoto.path);
      thumbnailUrl = toFileUrl(dbPhoto.path);
    } else {
      thumbnailUrl = PLACEHOLDER_IMAGE;
      previewUrl = PLACEHOLDER_IMAGE;
    }
  }

  const result: Photo = {
    id: String(dbPhoto.id || Math.random()),
    fileName: fileName,
    filePath: dbPhoto.path,
    thumbnailUrl,
    previewUrl,
    hash: dbPhoto.hash || '',
    cameraModel: dbPhoto.camera_model || '',
    dateTime: parseDbDateTime(dbPhoto.date_time) || parseDbDateTime(dbPhoto.shot_at) || parseDbDateTime(dbPhoto.created_at) || new Date().toISOString(),
    filmMode: dbPhoto.film_mode || '',
    isFavorite: false,
    isHidden: false,
    isRecipeDisplay: dbPhoto.source_type === 'recipe_display' || Boolean(dbPhoto.is_recipe_display),
    rating: 0,
    tags: dbPhoto.tags ? dbPhoto.tags.split(',').filter((t: string) => t.trim()) : [],
    folderId: dbPhoto.folder_id !== undefined && dbPhoto.folder_id !== null ? String(dbPhoto.folder_id) : undefined,
    ownerId: 'local',
    size: dbPhoto.size !== undefined && dbPhoto.size !== null ? String(dbPhoto.size) : '0',
    // 从 metadataJson 中提取字段
    metadataJson: null,
  };

  try {
    result.metadataJson = dbPhoto.metadata_json
      ? (typeof dbPhoto.metadata_json === 'string' ? JSON.parse(dbPhoto.metadata_json) : dbPhoto.metadata_json)
      : null;
  } catch {
    result.metadataJson = null;
  }

  // 从 metadataJson 中提取常用字段
  const metadata = result.metadataJson as Record<string, any> | null;
  if (metadata) {
    const make = readMetadataValue(metadata, ['Make', 'EXIF:Make']);
    const model = readMetadataValue(metadata, ['Model', 'EXIF:Model']);
    if (make || model) {
      result.cameraModel = [make, model].filter(Boolean).join(' ');
    }
    const lensModel = readMetadataValue(metadata, ['LensModel', 'EXIF:LensModel']);
    if (lensModel) {
      result.lensModel = String(lensModel);
    }
    if (metadata.FNumber) {
      const fNum = typeof metadata.FNumber === 'object' ? `${metadata.FNumber.numerator}/${metadata.FNumber.denominator}` : String(metadata.FNumber);
      result.aperture = fNum;
    }
    if (metadata.ExposureTime) {
      if (typeof metadata.ExposureTime === 'object') {
        const num = metadata.ExposureTime.numerator;
        const den = metadata.ExposureTime.denominator;
        result.shutterSpeed = den === 1 ? String(num) : `${num}/${den}`;
      } else {
        result.shutterSpeed = String(metadata.ExposureTime);
      }
    }
    if (metadata.ISOSpeedRatings) {
      const isoVal = Array.isArray(metadata.ISOSpeedRatings) ? metadata.ISOSpeedRatings[0] : metadata.ISOSpeedRatings;
      result.iso = typeof isoVal === 'number' ? isoVal : parseInt(String(isoVal), 10) || 0;
    }
    if (metadata.FocalLength) {
      const fl = typeof metadata.FocalLength === 'object' ? metadata.FocalLength.numerator / metadata.FocalLength.denominator : parseFloat(String(metadata.FocalLength));
      result.focalLength = fl ? `${fl}mm` : '';
      result.focalLength35mm = Math.round(fl * 1.5) || 0;
    }
    if (metadata.DateTimeOriginal) {
      const dt = metadata.DateTimeOriginal;
      if (typeof dt === 'string') {
        result.dateTime = dt.replace(/^(\d{4}):(\d{2}):(\d{2})\s+/, '$1-$2-$3T');
      } else if (dt.year) {
        const pad = (n: number) => String(n).padStart(2, '0');
        result.dateTime = `${dt.year}-${pad(dt.month)}-${pad(dt.day)}T${pad(dt.hour || 0)}:${pad(dt.minute || 0)}:${pad(dt.second || 0)}`;
      }
    } else if (metadata.CreateDate) {
      const dt = metadata.CreateDate;
      if (typeof dt === 'string') {
        result.dateTime = dt.replace(/^(\d{4}):(\d{2}):(\d{2})\s+/, '$1-$2-$3T');
      }
    }
    const filmMode = readMetadataValue(metadata, ['filmSimulation', 'filmMode', 'FilmSimulation', 'FilmMode', 'FujiFilm:FilmMode']);
    if (filmMode !== undefined && filmMode !== null && filmMode !== '') {
      result.filmMode = String(filmMode);
    }
    const dynamicRange = readMetadataValue(metadata, ['dynamicRange', 'DynamicRange', 'FujiFilm:DynamicRange', 'DynamicRangeSetting']);
    if (dynamicRange !== undefined) {
      result.dynamicRange = dynamicRange === 1 ? 'DR100' : dynamicRange === 3 ? 'Wide' : String(dynamicRange);
    }
    const whiteBalance = readMetadataValue(metadata, ['whiteBalance', 'WhiteBalance', 'FujiFilm:WhiteBalance']);
    if (whiteBalance !== undefined) {
      result.whiteBalance = String(whiteBalance);
    }
    const sharpness = readMetadataValue(metadata, ['sharpness', 'Sharpness']);
    if (sharpness !== undefined) {
      result.sharpness = String(sharpness);
    }
    const saturation = readMetadataValue(metadata, ['saturation', 'Saturation']);
    if (saturation !== undefined) {
      result.saturation = String(saturation);
    }
    const contrast = readMetadataValue(metadata, ['contrast', 'Contrast']);
    if (contrast !== undefined) {
      result.contrast = String(contrast);
    }
    const highlightTone = readMetadataValue(metadata, ['highlightTone', 'Highlight']);
    if (highlightTone !== undefined) {
      result.highlightTone = String(highlightTone);
    }
    const shadowTone = readMetadataValue(metadata, ['shadowTone', 'Shadow']);
    if (shadowTone !== undefined) {
      result.shadowTone = String(shadowTone);
    }
    const noiseReduction = readMetadataValue(metadata, ['noiseReduction', 'NoiseReduction']);
    if (noiseReduction !== undefined) {
      result.noiseReduction = String(noiseReduction);
    }
    const clarity = readMetadataValue(metadata, ['clarity', 'Clarity']);
    if (clarity !== undefined) {
      result.clarity = String(clarity);
    }
    const colorChromeEffect = readMetadataValue(metadata, ['colorChromeEffect', 'ColorChromeEffect', 'FujiFilm:ColorChromeEffect']);
    if (colorChromeEffect !== undefined) {
      result.colorChrome = String(colorChromeEffect);
      result.colorChromeEffect = String(colorChromeEffect);
    }
    const colorChromeEffectBlue = readMetadataValue(metadata, ['colorChromeEffectBlue', 'ColorChromeEffectBlue', 'FujiFilm:ColorChromeEffectBlue']);
    if (colorChromeEffectBlue !== undefined) {
      result.colorChromeBlue = String(colorChromeEffectBlue);
      result.colorChromeEffectBlue = String(colorChromeEffectBlue);
    }
    const grainEffect = readMetadataValue(metadata, ['grainEffect', 'GrainEffect', 'FujiFilm:GrainEffect']);
    if (grainEffect !== undefined) {
      result.grainEffect = String(grainEffect);
    }
    if (metadata.ImageWidth) {
      result.width = metadata.ImageWidth;
    }
    if (metadata.ImageHeight) {
      result.height = metadata.ImageHeight;
    }
  }
  
  return result;
}

/**
 * Converts a database folder object to a Folder type
 */
export function convertDbFolderToFolder(dbFolder: any): Folder {
  const folderPath = dbFolder.path || '';
  const folderType = dbFolder.folder_type || dbFolder.type || (folderPath ? 'physical' : 'logical');
  const includeSubfolders = dbFolder.include_subfolders ?? dbFolder.includeSubfolders ?? true;
  const photoCount = dbFolder.photo_count ?? dbFolder.photoCount ?? 0;
  const sortOrderRaw = dbFolder.sort_order ?? dbFolder.sortOrder ?? 0;
  const lastSynced = dbFolder.last_synced ?? dbFolder.lastSynced ?? null;
  const parentRaw = dbFolder.parent_id ?? dbFolder.parentId ?? -1;
  const parentId = parentRaw === null || parentRaw === undefined || parentRaw === '' || Number(parentRaw) === 0
    ? '-1'
    : String(parentRaw);

  return {
    id: String(dbFolder.id),
    name: dbFolder.name,
    path: folderPath,
    type: folderType,
    includeSubfolders: Boolean(includeSubfolders),
    photoCount: Number(photoCount),
    sortOrder: Number(sortOrderRaw) || 0,
    lastSynced: lastSynced ? new Date(lastSynced).toISOString() : '',
    parentId
  };
}
