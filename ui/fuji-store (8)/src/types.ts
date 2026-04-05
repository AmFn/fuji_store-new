export interface Photo {
  id: string;
  fileName: string;
  filePath: string;
  thumbnailUrl: string;
  cameraModel?: string;
  lensModel?: string;
  dateTime?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: number;
  focalLength?: string;
  filmMode?: string;
  whiteBalance?: string;
  whiteBalanceShift?: string;
  dynamicRange?: string;
  sharpness?: string;
  saturation?: string;
  contrast?: string;
  clarity?: string;
  shadowTone?: string;
  highlightTone?: string;
  noiseReduction?: string;
  grainEffect?: string;
  colorChromeEffect?: string;
  colorChromeEffectBlue?: string;
  isFavorite: boolean;
  isHidden: boolean;
  rating: number;
  tags: string[];
  recipeId?: string;
  folderId?: string;
  ownerId: string;
  size?: string;
  location?: string;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  filmMode?: string;
  whiteBalance?: string;
  dynamicRange?: string;
  sharpness?: string;
  saturation?: string;
  contrast?: string;
  clarity?: string;
  shadowTone?: string;
  highlightTone?: string;
  noiseReduction?: string;
  grainEffect?: string;
  colorChromeEffect?: string;
  colorChromeEffectBlue?: string;
  color?: string;
  whiteBalanceShift?: string;
  isFavorite: boolean;
  ownerId: string;
  imageUrls?: string[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  ownerId: string;
}

export interface Folder {
  id: string;
  name: string;
  path: string;
  type: 'physical' | 'logical';
  includeSubfolders: boolean;
  photoCount: number;
  lastSynced?: string;
  parentId?: string;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}
