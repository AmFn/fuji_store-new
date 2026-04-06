export interface Photo {
  id: string;
  fileName: string;
  filePath: string;
  thumbnailUrl: string;
  previewUrl: string;
  hash?: string;
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
  metadataJson?: any;
  isFavorite: boolean;
  isHidden: boolean;
  isRecipeDisplay: boolean;
  rating: number;
  tags: string[];
  recipeId?: string;
  folderId?: string;
  ownerId: string;
  size?: string;
  location?: string;
  // 富士相机参数
  colorChrome?: string;
  colorChromeBlue?: string;
  colorChromeRed?: string;
  grainEffectRough?: string;
  tone?: string;
  highISONoiseReduction?: string;
  aperture?: string;
  shutterSpeed?: string;
  exposureCompensation?: number;
  exposureMode?: string;
  meteringMode?: string;
  whiteBalanceMode?: string;
  whiteBalanceTemperature?: number;
  whiteBalanceTint?: number;
  focusMode?: string;
  focusArea?: string;
  afPoint?: string;
  flashFired?: number;
  flashMode?: string;
  lensMake?: string;
  focalLength35mm?: number;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
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
  color?: string;
  isFavorite: boolean;
  ownerId: string;
  imageUrls?: string[];
  createdAt?: string;
  updatedAt?: string;
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
  sortOrder?: number;
  lastSynced?: string;
  parentId?: string;
}
