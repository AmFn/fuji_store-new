/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { toJpeg } from 'html-to-image';

declare global {
  interface Window {
    electronAPI: {
      scanDirectory: (targetPath: string) => Promise<any>;
      getPhotosPage: (page: number, pageSize: number) => Promise<{ items: any[]; total?: number; page?: number; pageSize?: number; totalPages?: number }>;
      getScanProgressV2: () => Promise<any>;
      resyncLibraryV2: () => Promise<any>;
      getThumbnail: (photoPath: string, hash?: string) => Promise<{ success: boolean; thumbnailPath?: string; status?: string; error?: string }>;
      getTimelineGroups: (page: number, pageSize: number) => Promise<{ items: any[]; total?: number; page?: number; totalPages?: number }>;
      getTimelinePhotosByDay: (dayKey: string, page: number, pageSize: number) => Promise<{ items: any[]; total?: number; page?: number; totalPages?: number }>;
      openFolderPath: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      getPhotos: (page: number, pageSize: number) => Promise<any[]>;
      getPhotoCount: () => Promise<number>;
      getAllFolders: () => Promise<any[]>;
      getAllTags: () => Promise<string[]>;
      getAllCameras: () => Promise<string[]>;
      getAllFilmModes: () => Promise<string[]>;
      getDateGroups: () => Promise<any[]>;
      getPhotosByDate: (dateStr: string, limit?: number, preferThumbnail?: boolean) => Promise<any[]>;
      pickFolder: () => Promise<string | null>;
      pickFiles: () => Promise<string[] | null>;
      scanFolder: (folderPath: string, watch?: boolean) => Promise<any>;
      scanFiles: (filePaths: string[]) => Promise<any>;
      updatePhoto: (photoPath: string, patch: any) => Promise<any>;
      deletePhoto: (photoId: string) => Promise<any>;
      restorePhoto: (photoPath: string) => Promise<any>;
      showInFolder: (photoPath: string) => Promise<void>;
      getStatus: () => Promise<any>;
      getThumbnailDir: () => Promise<string>;
      clearThumbnailCache: () => Promise<{ success: boolean; deleted?: number; error?: string }>;
      getScanProgress: (folderPath: string) => Promise<any>;
      resyncLibrary: () => Promise<any>;
      getWatchedFolders: () => Promise<any[]>;
      scanForNewFiles: (folderPath: string) => Promise<any>;
      scanFolderAllFiles: (folderPath: string) => Promise<any>;
      createFolder: (folder: any) => Promise<any>;
      updateFolder: (folder: any) => Promise<any>;
      deleteFolder: (folderId: string) => Promise<any>;
      onLibraryUpdated: (listener: (payload: any) => void) => () => void;
    };
  }
}

import { 
  Images, 
  Clock, 
  Heart, 
  Tags, 
  EyeOff, 
  BarChart3, 
  FlaskConical, 
  Plus, 
  Search, 
  LayoutGrid, 
  List, 
  Filter, 
  ArrowUpDown,
  Settings,
  X,
  Camera,
  Calendar,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  Star,
  Sparkles,
  Download,
  ExternalLink,
  Folder as FolderIcon,
  RefreshCw,
  Edit2,
  FolderPlus,
  Layout,
  Image as ImageIcon,
  Palette,
  Share2,
  Check,
  Film,
  Edit3,
  Sun,
  Zap,
  Target,
  Moon,
  Layers,
  Droplets,
  Eye,
  Plane,
  HardDrive,
  RotateCcw,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import exifr from 'exifr';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { cn } from './lib/utils';
import { Photo, Recipe, Tag, Folder } from './types';

// Mock User Type
interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

// --- Constants ---
const FILM_MODES = [
  'Provia/Standard', 'Velvia/Vivid', 'Astia/Soft', 'Classic Chrome', 
  'PRO Neg. Hi', 'PRO Neg. Std', 'Classic Neg.', 'Nostalgic Neg.',
  'Eterna/Cinema', 'Eterna Bleach Bypass', 'Acros', 'Monochrome', 'Sepia',
  'Reala Ace'
];

const FILM_SHORT_CODES: Record<string, string> = {
  'Provia/Standard': 'STD',
  'Velvia/Vivid': 'V',
  'Astia/Soft': 'S',
  'Classic Chrome': 'CC',
  'PRO Neg. Hi': 'NH',
  'PRO Neg. Std': 'NS',
  'Classic Neg.': 'NC',
  'Nostalgic Neg.': 'NN',
  'Eterna/Cinema': 'E',
  'Eterna Bleach Bypass': 'EBB',
  'Acros': 'A',
  'Monochrome': 'M',
  'Sepia': 'SEP',
  'Reala Ace': 'RA'
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

function normalizeFsPath(input: string) {
  return (input || '').replace(/\\/g, '/').toLowerCase();
}

function isPhotoInFolder(photo: Photo, folder?: Folder | null) {
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
  return photo.folderId === folder.id;
}

function convertDbPhotoToPhoto(dbPhoto: any, thumbDir?: string | null): Photo {
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

  const pathParts = dbPhoto.path.split(/[/\\]/);
  const fileName = pathParts[pathParts.length - 1];

  let thumbnailUrl = '';
  let previewUrl = '';

  if (dbPhoto.thumbnail_status === 'done' && dbPhoto.hash && typeof thumbDir === 'string') {
    const normalizedDir = thumbDir.replace(/\\/g, '/');
    thumbnailUrl = `file://${normalizedDir}/${dbPhoto.hash}.jpg`;
    previewUrl = `file://${dbPhoto.path.replace(/\\/g, '/')}`;
  } else {
    const normalizedPath = dbPhoto.path.replace(/\\/g, '/');
    thumbnailUrl = `file://${normalizedPath}`;
    previewUrl = `file://${normalizedPath}`;
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
    location: dbPhoto.location || ''
  };
}

function convertDbFolderToFolder(dbFolder: any): Folder {
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

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>({ 
    uid: 'demo', 
    email: 'feng46042@gmail.com', 
    displayName: 'Fuji User',
    photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fuji'
  } as any);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'photos' | 'timeline' | 'recipes' | 'stats' | 'settings' | 'favorites' | 'hidden' | 'tags' | 'posters' | 'templates'>('photos');
  const [importModalInitialType, setImportModalInitialType] = useState<'files' | 'folders'>('files');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoPage, setPhotoPage] = useState(1);
  const [hasMorePhotos, setHasMorePhotos] = useState(true);
  const [loadingMorePhotos, setLoadingMorePhotos] = useState(false);
  const PHOTO_PAGE_SIZE = 120;
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [thumbnailDir, setThumbnailDir] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([
    {
      id: 'r1',
      name: 'Kodak Portra 400',
      description: 'Warm and nostalgic tones for street photography.',
      filmMode: 'Classic Chrome',
      whiteBalance: 'Auto',
      dynamicRange: 'DR400',
      sharpness: '-2',
      saturation: '+1',
      contrast: '-1',
      clarity: '-2',
      shadowTone: '+1',
      highlightTone: '-1',
      noiseReduction: '-4',
      grainEffect: 'Strong',
      isFavorite: true,
      ownerId: 'demo'
    },
    {
      id: 'r2',
      name: 'Cinestill 800T',
      description: 'Cool shadows and glowing highlights for night shots.',
      filmMode: 'Eterna',
      whiteBalance: '3200K',
      dynamicRange: 'DR200',
      sharpness: '0',
      saturation: '+2',
      contrast: '+1',
      clarity: '0',
      shadowTone: '+2',
      highlightTone: '+1',
      noiseReduction: '-2',
      grainEffect: 'Weak',
      isFavorite: false,
      ownerId: 'demo'
    },
    {
      id: 'r3',
      name: 'Tri-X 400',
      description: 'High contrast black and white with deep blacks.',
      filmMode: 'Acros',
      whiteBalance: 'Auto',
      dynamicRange: 'DR100',
      sharpness: '+1',
      saturation: 'N/A',
      contrast: '+2',
      clarity: '+1',
      shadowTone: '+2',
      highlightTone: '+2',
      noiseReduction: '-4',
      grainEffect: 'Strong',
      isFavorite: true,
      ownerId: 'demo'
    },
    {
      id: 'r4',
      name: 'Fujicolor Superia 400',
      description: 'Greenish tints and natural skin tones.',
      filmMode: 'Classic Neg.',
      whiteBalance: 'Daylight',
      dynamicRange: 'DR200',
      sharpness: '0',
      saturation: '0',
      contrast: '+1',
      clarity: '0',
      shadowTone: '+1',
      highlightTone: '0',
      noiseReduction: '-2',
      grainEffect: 'Weak',
      isFavorite: false,
      ownerId: 'demo'
    },
    {
      id: 'r5',
      name: 'Kodak Gold 200',
      description: 'Warm, golden tones with a classic film look.',
      filmMode: 'Classic Chrome',
      whiteBalance: 'Auto',
      dynamicRange: 'DR200',
      sharpness: '-1',
      saturation: '+2',
      contrast: '0',
      clarity: '-1',
      shadowTone: '0',
      highlightTone: '+1',
      noiseReduction: '-4',
      grainEffect: 'Weak',
      isFavorite: true,
      ownerId: 'demo'
    },
    {
      id: 'r6',
      name: 'Eterna Cinema',
      description: 'Soft tones and low saturation for a cinematic look.',
      filmMode: 'Eterna',
      whiteBalance: 'Auto',
      dynamicRange: 'DR400',
      sharpness: '-1',
      saturation: '-2',
      contrast: '-1',
      clarity: '0',
      shadowTone: '0',
      highlightTone: '-1',
      noiseReduction: '0',
      grainEffect: 'Off',
      isFavorite: false,
      ownerId: 'demo'
    },
    {
      id: 'r7',
      name: 'Classic Negative Street',
      description: 'High contrast and unique color shifts for urban scenes.',
      filmMode: 'Classic Neg.',
      whiteBalance: 'Auto',
      dynamicRange: 'DR200',
      sharpness: '+1',
      saturation: '0',
      contrast: '+2',
      clarity: '+1',
      shadowTone: '+1',
      highlightTone: '+1',
      noiseReduction: '-2',
      grainEffect: 'Weak',
      isFavorite: true,
      ownerId: 'demo'
    },
    {
      id: 'r8',
      name: 'Astia Portrait',
      description: 'Soft skin tones and vibrant colors for portraits.',
      filmMode: 'Astia/Soft',
      whiteBalance: 'Daylight',
      dynamicRange: 'DR100',
      sharpness: '0',
      saturation: '+1',
      contrast: '-1',
      clarity: '-1',
      shadowTone: '-1',
      highlightTone: '0',
      noiseReduction: '0',
      grainEffect: 'Off',
      isFavorite: false,
      ownerId: 'demo'
    }
  ]);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncFolderId, setSyncFolderId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportPhoto, setExportPhoto] = useState<Photo | null>(null);
  const [initialExportTemplate, setInitialExportTemplate] = useState('minimal');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterFilmMode, setFilterFilmMode] = useState('All');
  const [filterExtension, setFilterExtension] = useState<'JPG' | 'RAF' | 'All'>('All');
  const [filterDate, setFilterDate] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [timelinePhotos, setTimelinePhotos] = useState<Photo[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (window.electronAPI) {
        try {
          const [thumbDir, photosPageData, foldersData, tagsData] = await Promise.all([
            window.electronAPI.getThumbnailDir(),
            window.electronAPI.getPhotosPage(1, PHOTO_PAGE_SIZE),
            window.electronAPI.getAllFolders(),
            window.electronAPI.getAllTags()
          ]);
          setThumbnailDir(thumbDir);
          let firstItems = (photosPageData?.items || []).map(p => convertDbPhotoToPhoto(p, thumbDir));
          
          // 添加模拟数据，如果数据库中没有照片
          if (firstItems.length === 0) {
            const testPhotos = [
              {
                path: 'test-photos/test-photo-1.jpg',
                hash: 'test1',
                size: 1024000,
                created_at: Date.now() - 86400000,
                thumbnail_status: 'done'
              },
              {
                path: 'test-photos/test-photo-2.jpg',
                hash: 'test2',
                size: 1536000,
                created_at: Date.now() - 172800000,
                thumbnail_status: 'done'
              },
              {
                path: 'test-photos/test-photo-3.jpg',
                hash: 'test3',
                size: 1280000,
                created_at: Date.now() - 259200000,
                thumbnail_status: 'done'
              },
              {
                path: 'test-photos/test-photo-4.jpg',
                hash: 'test4',
                size: 960000,
                created_at: Date.now() - 345600000,
                thumbnail_status: 'done'
              },
              {
                path: 'test-photos/test-photo-5.jpg',
                hash: 'test5',
                size: 1152000,
                created_at: Date.now() - 432000000,
                thumbnail_status: 'done'
              }
            ];
            firstItems = testPhotos.map(p => convertDbPhotoToPhoto(p, thumbDir));
          }
          
          setPhotos(firstItems);
          setPhotoPage(1);
          const totalPages = photosPageData?.totalPages || 1;
          setHasMorePhotos(1 < totalPages);
          setFolders((foldersData || []).map(convertDbFolderToFolder));
          setTags((tagsData || []).map((name: string) => ({
            id: name,
            name,
            color: '#3b82f6',
            ownerId: 'local'
          })));
        } catch (err) {
          console.error('Failed to load data:', err);
          // 即使API调用失败，也添加模拟数据
          const mockPhotos = [
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
          setPhotos(mockPhotos);
          setHasMorePhotos(false);
        }
      } else {
        // 如果electronAPI不可用，添加模拟数据
        const mockPhotos = [
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
        setPhotos(mockPhotos);
        setHasMorePhotos(false);
      }
    };

    loadData();

    if (window.electronAPI?.onLibraryUpdated) {
      const unsubscribe = window.electronAPI.onLibraryUpdated(() => {
        loadData();
      });
      return () => unsubscribe();
    }
  }, []);

  const loadMorePhotosFromDb = async () => {
    if (loadingMorePhotos || !hasMorePhotos) return;
    if (!window.electronAPI) return;
    try {
      setLoadingMorePhotos(true);
      const nextPage = photoPage + 1;
      const pageData = await window.electronAPI.getPhotosPage(nextPage, PHOTO_PAGE_SIZE);
      const nextItems = (pageData?.items || []).map(p => convertDbPhotoToPhoto(p, thumbnailDir));
      if (nextItems.length > 0) {
        setPhotos(prev => [...prev, ...nextItems]);
      }
      setPhotoPage(nextPage);
      const totalPages = pageData?.totalPages || nextPage;
      setHasMorePhotos(nextPage < totalPages);
    } catch (err) {
      console.error('Failed to load more photos:', err);
      setHasMorePhotos(false);
    } finally {
      setLoadingMorePhotos(false);
    }
  };

  useEffect(() => {
    if (activeView !== 'timeline') return;
    let disposed = false;
    const loadTimelineFromApi = async () => {
      if (!window.electronAPI?.getTimelineGroups || !window.electronAPI?.getTimelinePhotosByDay) return;
      setTimelineLoading(true);
      try {
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
            const rows = (dayRes?.items || []).map(convertDbPhotoToPhoto);
            allTimelinePhotos.push(...rows);
            const totalPages = dayRes?.totalPages || dayPage;
            if (dayPage >= totalPages || rows.length === 0) break;
            dayPage += 1;
            if (dayPage > 200) break;
          }
        }

        if (!disposed) {
          setTimelinePhotos(allTimelinePhotos);
        }
      } catch (err) {
        console.error('loadTimelineFromApi failed:', err);
      } finally {
        if (!disposed) setTimelineLoading(false);
      }
    };
    void loadTimelineFromApi();
    return () => {
      disposed = true;
    };
  }, [activeView]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('fuji-theme') as 'light' | 'dark';
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem('fuji-theme', theme);
  }, [theme]);

  const handleRecognizeRecipe = async (photo: Photo) => {
    try {
      alert('AI recipe recognition is not available in local mode. Please manually select a recipe.');
    } catch (err) {
      console.error('Error recognizing recipe:', err);
      alert('Failed to recognize recipe.');
    }
  };

  useEffect(() => {
    // Mock sync effect
    console.log('Mock data sync initialized');
  }, [user]);

  const activeFolder = folders.find((f) => f.id === activeFolderId) || null;
  const filteredPhotos = photos.filter(p => {
    const matchesSearch = p.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.cameraModel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.filmMode?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilm = filterFilmMode === 'All' || p.filmMode === filterFilmMode;
    const matchesExtension = filterExtension === 'All' || p.fileName.toUpperCase().endsWith(`.${filterExtension}`);
    const matchesDate = !filterDate || p.dateTime?.startsWith(filterDate);
    const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => p.tags?.includes(tag));
    const matchesFolder = !activeFolderId || isPhotoInFolder(p, activeFolder);
    
    const matchesView = activeView === 'photos' ? true :
                       activeView === 'favorites' ? p.isFavorite :
                       true;
    
    const result = matchesSearch && matchesFilm && matchesExtension && matchesDate && matchesTags && matchesFolder && matchesView;
    return result;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.fileName.localeCompare(b.fileName);
    } else if (sortBy === 'date') {
      comparison = new Date(a.dateTime || '').getTime() - new Date(b.dateTime || '').getTime();
    } else if (sortBy === 'size') {
      comparison = parseInt(a.size || '0') - parseInt(b.size || '0');
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  // 添加日志来调试
  useEffect(() => {
    console.log('Photos state:', photos.length, 'photos');
    console.log('Filtered photos:', filteredPhotos.length, 'photos');
    console.log('Active view:', activeView);
    console.log('Filter extension:', filterExtension);
    console.log('Filter film mode:', filterFilmMode);
    console.log('Selected tags:', selectedTags);
    console.log('Active folder:', activeFolderId);
  }, [photos, filteredPhotos, activeView, filterExtension, filterFilmMode, selectedTags, activeFolderId]);

  const handleFolderRename = async (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const newName = window.prompt('Enter new folder name:', folder.name);
    if (newName && newName !== folder.name) {
      if (window.electronAPI?.updateFolder) {
        await window.electronAPI.updateFolder({ id, name: newName });
      }
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    }
  };

  const handleFolderAddSubfolder = async (parentId: string) => {
    const parent = folders.find(f => f.id === parentId);
    const newName = window.prompt(`Enter subfolder name for "${parent?.name}":`, 'New Subfolder');
    if (newName) {
      if (window.electronAPI?.createFolder) {
        const created = await window.electronAPI.createFolder({
          name: newName,
          parentId,
          path: parent?.type === 'physical' && parent?.path ? `${parent.path}/${newName}` : null,
          type: parent?.type === 'physical' ? 'physical' : 'logical',
          includeSubfolders: true,
          photoCount: 0,
          lastSynced: Date.now(),
        });
        const mapped = convertDbFolderToFolder(created);
        setFolders(prev => [...prev, mapped]);
      }
    }
  };

  const handleFolderAddFiles = (id: string) => {
    setActiveFolderId(id);
    setImportModalInitialType('files');
    setIsImportModalOpen(true);
  };

  const handleFolderReorder = (draggedId: string, targetId: string) => {
    setFolders(prev => {
      const next = [...prev];
      const draggedIdx = next.findIndex(f => f.id === draggedId);
      const targetIdx = next.findIndex(f => f.id === targetId);
      if (draggedIdx !== -1 && targetIdx !== -1) {
        const [removed] = next.splice(draggedIdx, 1);
        next.splice(targetIdx, 0, removed);
      }
      return next;
    });
  };

  const handleUpdatePhoto = (id: string, updates: Partial<Photo>) => {
    const target = photos.find(p => p.id === id);
    if (target && window.electronAPI?.updatePhoto) {
      void window.electronAPI.updatePhoto(target.filePath, updates).catch((err) => {
        console.error('updatePhoto failed:', err);
      });
    }
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleToggleFavorite = (id: string) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
  };

  const handleDeletePhoto = (id: string) => {
    if (window.electronAPI?.deletePhoto) {
      void window.electronAPI.deletePhoto(id).catch((err) => {
        console.error('deletePhoto failed:', err);
      });
    }
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleDeleteTag = (tagId: string) => {
    if (window.confirm('Are you sure you want to delete this tag? This will remove it from all photos.')) {
      const tag = tags.find(t => t.id === tagId);
      if (tag) {
        if (window.electronAPI?.updatePhoto) {
          const affected = photos.filter(p => (p.tags || []).includes(tag.name));
          for (const p of affected) {
            const nextTags = (p.tags || []).filter(t => t !== tag.name);
            void window.electronAPI.updatePhoto(p.filePath, { tags: nextTags }).catch((err) => {
              console.error('updatePhoto tags failed:', err);
            });
          }
        }
        setTags(prev => prev.filter(t => t.id !== tagId));
        setPhotos(prev => prev.map(p => ({
          ...p,
          tags: p.tags?.filter(t => t !== tag.name) || []
        })));
      }
    }
  };

  const handleAddTag = (tag: Tag) => {
    setTags(prev => [...prev, tag]);
  };

  const handleAddRecipe = (recipe: Recipe) => {
    setRecipes(prev => [...prev, recipe]);
  };

  const handleUpdateFolder = (id: string, updates: Partial<Folder>) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  return (
    <div className={cn(
      "h-screen w-screen flex overflow-hidden font-sans transition-colors duration-300",
      theme === 'dark' ? "dark bg-[#0a0a0a] text-white" : "bg-slate-50 text-slate-900"
    )}>
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-secondary)]/50 backdrop-blur-xl">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Images className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">Fuji Store</span>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <NavItem 
            icon={<Images className="w-4 h-4" />} 
            label="All Photos" 
            active={activeView === 'photos'} 
            onClick={() => {
              setActiveFolderId(null);
              setActiveView('photos');
            }} 
            theme={theme}
          />
          <NavItem 
            icon={<Clock className="w-4 h-4" />} 
            label="Timeline" 
            active={activeView === 'timeline'} 
            onClick={() => setActiveView('timeline')} 
            theme={theme}
          />
          <NavItem 
            icon={<Heart className="w-4 h-4" />} 
            label="Favorites" 
            active={activeView === 'favorites'} 
            onClick={() => setActiveView('favorites')} 
            theme={theme}
          />
          <NavItem 
            icon={<Tags className="w-4 h-4" />} 
            label="Tags" 
            active={activeView === 'tags'} 
            onClick={() => setActiveView('tags')} 
            theme={theme}
          />
          <NavItem 
            icon={<BarChart3 className="w-4 h-4" />} 
            label="Stats" 
            active={activeView === 'stats'} 
            onClick={() => setActiveView('stats')} 
            theme={theme}
          />
          <NavItem 
            icon={<FlaskConical className="w-4 h-4" />} 
            label="Recipes" 
            active={activeView === 'recipes'} 
            onClick={() => setActiveView('recipes')} 
            theme={theme}
          />
          <NavItem 
            icon={<Palette className="w-4 h-4" />} 
            label="Templates" 
            active={activeView === 'templates'} 
            onClick={() => setActiveView('templates')} 
            theme={theme}
          />

          <div className="pt-8 pb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
            Directories
            <button 
              onClick={() => {
                setImportModalInitialType('folders');
                setIsImportModalOpen(true);
              }}
              className="p-1 hover:bg-slate-500/10 rounded-md transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1 px-2">
            <DirectoryTree 
              folders={folders} 
              activeFolderId={activeFolderId}
              onFolderSelect={(id) => {
                setActiveFolderId(id);
                setActiveView('photos');
              }}
              onRefresh={(id) => {
                setSyncFolderId(id);
                setIsSyncModalOpen(true);
              }} 
              onRename={handleFolderRename}
              onAddSubfolder={handleFolderAddSubfolder}
              onAddFiles={handleFolderAddFiles}
              onReorder={handleFolderReorder}
              photos={photos} 
              onUpdatePhoto={handleUpdatePhoto}
              onDeleteFolder={async (folderId) => {
                if (window.electronAPI?.deleteFolder) {
                  await window.electronAPI.deleteFolder(folderId);
                }
                setFolders(prev => prev.filter(f => f.id !== folderId));
              }}
              onOpenFolderPath={async (folderPath) => {
                if (!folderPath || !window.electronAPI?.openFolderPath) return;
                const result = await window.electronAPI.openFolderPath(folderPath);
                if (!result?.success) {
                  console.error('Open physical folder failed:', result?.error);
                }
              }}
            />
          </div>
        </nav>

        <div className="p-4 border-t border-[var(--border-color)] space-y-4">
          <div className="flex items-center gap-3 px-2">
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-blue-500/20" alt="User" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 hover:bg-blue-500/10 rounded-lg transition-colors text-blue-500"
            >
              {theme === 'dark' ? <Star className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </button>
          </div>
          <button 
            onClick={() => setActiveView('settings')}
            className={cn(
              "w-full py-2 flex items-center justify-center gap-2 text-xs font-semibold transition-colors rounded-lg",
              activeView === 'settings' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-blue-500 hover:bg-blue-500/5"
            )}
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[var(--bg-primary)]">
        {/* Header / Toolbar - Conditionally rendered */}
        {(activeView === 'photos' || activeView === 'favorites') && (
          <header className="h-20 border-b border-[var(--border-color)] flex items-center justify-between px-8 bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 z-10">
            <div className="flex items-center gap-6 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search photos, models, recipes..." 
                  className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center bg-slate-500/5 border border-[var(--border-color)] rounded-xl p-1">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-white text-blue-600 shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-400 hover:text-slate-600")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-white text-blue-600 shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-400 hover:text-slate-600")}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center bg-slate-500/5 border border-[var(--border-color)] rounded-xl p-1">
                <button 
                  onClick={() => setFilterExtension('JPG')}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-black transition-all", filterExtension === 'JPG' ? "bg-blue-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600")}
                >
                  JPG
                </button>
                <button 
                  onClick={() => setFilterExtension('RAF')}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-black transition-all", filterExtension === 'RAF' ? "bg-blue-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600")}
                >
                  RAF
                </button>
                <button 
                  onClick={() => setFilterExtension('All')}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-black transition-all", filterExtension === 'All' ? "bg-blue-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600")}
                >
                  ALL
                </button>
              </div>
              
              <button 
                onClick={() => setIsAdvancedFilterOpen(!isAdvancedFilterOpen)}
                className={cn(
                  "p-2.5 rounded-xl border transition-all flex items-center gap-2 text-sm font-bold",
                  isAdvancedFilterOpen ? "bg-blue-500/10 border-blue-500/30 text-blue-500" : "bg-slate-500/5 border-[var(--border-color)] text-slate-500 hover:bg-slate-500/10"
                )}
              >
                <Filter className="w-4 h-4" />
                Advanced
              </button>

              <button 
                onClick={() => {
                  setImportModalInitialType('files');
                  setIsImportModalOpen(true);
                }}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                Import
              </button>
            </div>
          </header>
        )}

        {/* Advanced Filters */}
        <AnimatePresence>
          {isAdvancedFilterOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-md overflow-hidden"
            >
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Filter</label>
                    {filterDate && (
                      <button 
                        onClick={() => setFilterDate('')}
                        className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <CustomDatePicker 
                    value={filterDate}
                    onChange={setFilterDate}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      { label: 'All', value: '' },
                      { label: 'Today', value: new Date().toISOString().split('T')[0] },
                      { label: '7 Days', value: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] },
                      { label: 'Month', value: new Date().toISOString().slice(0, 7) }
                    ].map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => setFilterDate(opt.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5",
                          (opt.value === '' ? filterDate === '' : filterDate.startsWith(opt.value))
                            ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105" 
                            : "bg-slate-500/5 border-[var(--border-color)] text-slate-400 hover:border-blue-500/30 hover:bg-slate-500/10"
                        )}
                      >
                        <div className={cn("w-1 h-1 rounded-full", (opt.value === '' ? filterDate === '' : filterDate.startsWith(opt.value)) ? "bg-white" : "bg-slate-400")} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 col-span-1 md:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Film Simulation</label>
                    {filterFilmMode !== 'All' && (
                      <button 
                        onClick={() => setFilterFilmMode('All')}
                        className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search simulation..."
                      className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500/50 transition-all"
                      value={filterFilmMode === 'All' ? '' : filterFilmMode}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) setFilterFilmMode('All');
                        else {
                          const found = FILM_MODES.find(m => m.toLowerCase().includes(val.toLowerCase()));
                          if (found) setFilterFilmMode(found);
                          else setFilterFilmMode(val);
                        }
                      }}
                    />
                  </div>

                  <div className="max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex flex-wrap gap-2">
                      {['All', ...FILM_MODES].map(mode => (
                        <button 
                          key={mode}
                          onClick={() => setFilterFilmMode(mode)}
                          className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5",
                            filterFilmMode === mode 
                              ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20" 
                              : "bg-slate-500/5 border-[var(--border-color)] text-slate-400 hover:border-blue-500/30"
                          )}
                        >
                          {mode === 'All' ? 'All' : (FILM_SHORT_CODES[mode] || mode)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-3 col-span-1 md:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tags</label>
                    {selectedTags.length > 0 && (
                      <button 
                        onClick={() => setSelectedTags([])}
                        className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline"
                      >
                        Clear ({selectedTags.length})
                      </button>
                    )}
                  </div>
                  
                  {/* Selected Tags Badges */}
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedTags.map(tagName => {
                        const tag = tags.find(t => t.name === tagName);
                        return (
                          <button 
                            key={tagName}
                            onClick={() => setSelectedTags(prev => prev.filter(t => t !== tagName))}
                            className="px-2 py-0.5 bg-blue-500 text-white rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-blue-600 transition-colors"
                          >
                            {tagName}
                            <X className="w-2.5 h-2.5" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search tags..."
                      className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500/50 transition-all"
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex flex-wrap gap-2">
                      {tags
                        .filter(tag => 
                          tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase()) && 
                          !selectedTags.includes(tag.name)
                        )
                        .map(tag => (
                          <button 
                            key={tag.id}
                            onClick={() => {
                              setSelectedTags(prev => [...prev, tag.name]);
                            }}
                            className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5 bg-slate-500/5 border-[var(--border-color)] text-slate-400 hover:border-blue-500/30"
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </button>
                        ))}
                      {tags.filter(tag => tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())).length === 0 && (
                        <p className="text-[10px] text-slate-500 italic w-full text-center py-2">No tags found</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-end pb-1">
                  <button 
                    onClick={() => {
                      setFilterDate('');
                      setFilterFilmMode('All');
                      setSelectedTags([]);
                      setFilterExtension('All');
                    }}
                    className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-500/20 flex items-center gap-2"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset All Filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {activeView === 'stats' ? (
              <StatsView key="stats" photos={photos} theme={theme} />
            ) : activeView === 'templates' ? (
              <ExportTemplates 
                key="templates" 
                theme={theme} 
                onTryTemplate={(templateId) => {
                  if (photos.length > 0) {
                    setExportPhoto(photos[0]);
                    setInitialExportTemplate(templateId);
                    setIsExportModalOpen(true);
                  }
                }}
              />
            ) : activeView === 'recipes' ? (
              <RecipeView key="recipes" recipes={recipes} photos={photos} user={user} theme={theme} onAddRecipe={handleAddRecipe} />
            ) : activeView === 'timeline' ? (
              timelineLoading ? (
                <div className="py-20 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                  Loading timeline...
                </div>
              ) : (
                <TimelineView 
                  key="timeline" 
                  photos={timelinePhotos}
                  onPhotoClick={setSelectedPhoto} 
                  onSearchDate={(date) => {
                    setFilterDate(date);
                    setActiveView('photos');
                    setIsAdvancedFilterOpen(true);
                  }}
                />
              )
            ) : activeView === 'tags' ? (
              <TagsView 
                key="tags" 
                tags={tags} 
                setTags={setTags} 
                photos={photos} 
                setPhotos={setPhotos}
                onTagClick={(tagName) => {
                  setSelectedTags([tagName]);
                  setActiveView('photos');
                }} 
              />
            ) : activeView === 'settings' ? (
              <SettingsView 
                key="settings" 
                theme={theme} 
                setTheme={setTheme} 
                folders={folders} 
                setFolders={setFolders}
                cloudSyncEnabled={cloudSyncEnabled}
                setCloudSyncEnabled={setCloudSyncEnabled}
                onFoldersChanged={setFolders}
              />
            ) : (
              <div className="space-y-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black tracking-tighter">
                      {activeFolderId 
                        ? folders.find(f => f.id === activeFolderId)?.name 
                        : activeView === 'photos' ? 'All Photos' : 
                          activeView === 'favorites' ? 'Favorites' : 'Photos'}
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                      {filteredPhotos.length} items in this view
                    </p>
                  </div>

                  {/* Top Sorting UI */}
                  <div className="flex items-center gap-3 bg-slate-500/5 p-2 rounded-2xl border border-[var(--border-color)] backdrop-blur-md">
                    <div className="flex items-center gap-2 px-3 border-r border-[var(--border-color)]">
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort</span>
                    </div>
                    <div className="flex gap-2">
                      {[
                        { label: 'Date', value: 'date' },
                        { label: 'Name', value: 'name' },
                        { label: 'Size', value: 'size' }
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setSortBy(opt.value as any)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            sortBy === opt.value 
                              ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-500/10"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="w-px h-6 bg-[var(--border-color)] mx-1" />
                    <button 
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="p-2 hover:bg-slate-500/10 rounded-xl transition-all group"
                      title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      <ArrowUpDown className={cn("w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-all", sortOrder === 'desc' && "rotate-180")} />
                    </button>
                  </div>
                </div>
                <div className={cn(
                  "grid gap-8",
                  viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" : "grid-cols-1"
                )}>
                  {filteredPhotos.map((photo, index) => (
                    <PhotoCard 
                      key={photo.id} 
                      photo={photo} 
                      mode={viewMode} 
                      onClick={() => setSelectedPhoto(photo)} 
                      theme={theme}
                      onToggleFavorite={handleToggleFavorite}
                      onDeletePhoto={handleDeletePhoto}
                    />
                  ))}
                  {loadingMorePhotos && (
                    <div className="py-6 flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                      Loading more...
                    </div>
                  )}
                </div>

                {filteredPhotos.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-400 space-y-6">
                    <div className="w-20 h-20 bg-slate-500/5 rounded-full flex items-center justify-center">
                      <Images className="w-10 h-10 opacity-20" />
                    </div>
                    <p className="font-medium">No photos found matching your criteria.</p>
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {selectedPhoto && (
          <PhotoDetailModal 
            photo={selectedPhoto} 
            onClose={() => setSelectedPhoto(null)} 
            recipes={recipes}
            folders={folders}
            onRecognize={handleRecognizeRecipe}
            theme={theme}
            allTags={tags}
            onExport={() => {
              setExportPhoto(selectedPhoto);
              setIsExportModalOpen(true);
            }}
            onUpdatePhoto={handleUpdatePhoto}
            onDeletePhoto={handleDeletePhoto}
            onAddTag={handleAddTag}
          />
        )}
        {isImportModalOpen && (
          <ImportModal 
            onClose={() => setIsImportModalOpen(false)} 
            user={user} 
            theme={theme}
            setFolders={setFolders}
            setPhotos={setPhotos}
            initialType={importModalInitialType}
            activeFolderId={activeFolderId}
            folders={folders}
          />
        )}
        {isSyncModalOpen && syncFolderId && (
        <SyncFolderModal 
          onClose={() => setIsSyncModalOpen(false)} 
          folderId={syncFolderId}
          folders={folders}
        />
      )}

      {isExportModalOpen && exportPhoto && (
          <RecipeExportModal 
            photo={exportPhoto}
            onClose={() => setIsExportModalOpen(false)}
            theme={theme}
            initialTemplate={initialExportTemplate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function CustomSelect({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  className 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  options: { label: string, value: string }[], 
  placeholder?: string,
  className?: string
}) {
  return (
    <div className={cn("relative group", className)}>
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-500/5 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold appearance-none cursor-pointer hover:bg-slate-500/10 transition-all pr-12 text-sm dark:text-white"
      >
        {placeholder && <option value="" className="bg-slate-900">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-blue-500 transition-colors">
        <ChevronDown className="w-4 h-4" />
      </div>
    </div>
  );
}

function CustomDatePicker({ 
  value, 
  onChange, 
  className 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  className?: string
}) {
  return (
    <div className={cn("relative group", className)}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors z-10">
        <Calendar className="w-4 h-4" />
      </div>
      <input 
        type="date" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-500/5 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl pl-12 pr-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold cursor-pointer hover:bg-slate-500/10 transition-all dark:color-scheme-dark text-sm dark:text-white"
      />
    </div>
  );
}

function DirectoryTree({ folders, onRefresh, photos, activeFolderId, onFolderSelect, onRename, onAddSubfolder, onAddFiles, onReorder, onUpdatePhoto, onOpenFolderPath, onDeleteFolder }: { 
  folders: Folder[], 
  onRefresh: (id: string) => void, 
  photos: Photo[], 
  activeFolderId: string | null, 
  onFolderSelect: (id: string | null) => void,
  onRename: (id: string) => void,
  onAddSubfolder: (id: string) => void,
  onAddFiles: (id: string) => void,
  onReorder: (draggedId: string, targetId: string) => void,
  onUpdatePhoto: (id: string, updates: Partial<Photo>) => void,
  onOpenFolderPath: (folderPath: string) => void | Promise<void>,
  onDeleteFolder: (id: string) => void | Promise<void>
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['1']));
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, folderId: string } | null>(null);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const photoId = e.dataTransfer.getData('photoId');
    const draggedFolderId = e.dataTransfer.getData('folderId');

    if (photoId) {
      onUpdatePhoto(photoId, { folderId: folderId });
    } else if (draggedFolderId && draggedFolderId !== folderId) {
      onReorder(draggedFolderId, folderId);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, folderId });
  };

  const handleFolderDragStart = (e: React.DragEvent, folderId: string) => {
    e.dataTransfer.setData('folderId', folderId);
  };

  return (
    <div className="space-y-1 relative" onClick={() => setContextMenu(null)}>
      {folders.map(node => {
        const photoCount = photos.filter(p => isPhotoInFolder(p, node)).length;
        const isActive = activeFolderId === node.id;
        return (
          <div 
            key={node.id} 
            className="space-y-1"
            draggable
            onDragStart={(e) => handleFolderDragStart(e, node.id)}
            onDragOver={(e) => handleDragOver(e, node.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, node.id)}
            onContextMenu={(e) => handleContextMenu(e, node.id)}
          >
            <div className={cn(
              "flex items-center group rounded-xl transition-all",
              dragOverId === node.id ? "bg-blue-500/20 scale-[1.02]" : "hover:bg-slate-500/5",
              isActive && "bg-blue-500/10"
            )}>
              <button 
                onClick={() => toggle(node.id)}
                className="p-1.5 hover:bg-slate-500/10 rounded-md transition-colors"
              >
                <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", !expanded.has(node.id) && "-rotate-90")} />
              </button>
              <button 
                onClick={() => onFolderSelect(isActive ? null : node.id)}
                className={cn(
                  "flex-1 px-2 py-2 rounded-lg flex items-center gap-3 text-xs font-bold transition-all truncate",
                  isActive ? "text-blue-500" : "text-slate-400 hover:text-blue-500"
                )}
              >
                {node.type === 'physical' ? (
                  <HardDrive className={cn("w-4 h-4 transition-colors", (dragOverId === node.id || isActive) ? "text-blue-500" : "opacity-50")} />
                ) : (
                  <FolderIcon className={cn("w-4 h-4 transition-colors", (dragOverId === node.id || isActive) ? "text-blue-500" : "opacity-50")} />
                )}
                <span className="truncate flex-1 text-left">{node.name}</span>
                <span className="text-[10px] opacity-40 font-black bg-slate-500/10 px-2 py-0.5 rounded-full">{photoCount || node.photoCount}</span>
              </button>
              {node.type === 'physical' && (
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      void onOpenFolderPath(node.path);
                    }}
                    className="p-2 hover:bg-blue-500/10 rounded-md transition-all text-blue-500"
                    title="Open original directory"
                  >
                    <Plane className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefresh(node.id);
                    }}
                    className="p-2 hover:bg-blue-500/10 rounded-md transition-all text-blue-500"
                    title="Refresh folder"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            className="fixed z-[100] w-48 glass-card rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden p-1.5"
          >
            <ContextMenuItem icon={<Edit2 className="w-3.5 h-3.5" />} label="Rename" onClick={() => onRename(contextMenu.folderId)} onClose={() => setContextMenu(null)} />
            <ContextMenuItem icon={<Plus className="w-3.5 h-3.5" />} label="Add Photos" onClick={() => onAddFiles(contextMenu.folderId)} onClose={() => setContextMenu(null)} />
            <ContextMenuItem icon={<FolderPlus className="w-3.5 h-3.5" />} label="New Subfolder" onClick={() => onAddSubfolder(contextMenu.folderId)} onClose={() => setContextMenu(null)} />
            <div className="h-px bg-[var(--border-color)] my-1.5 mx-2" />
            <ContextMenuItem icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />} label="Delete" onClick={() => { void onDeleteFolder(contextMenu.folderId); }} danger onClose={() => setContextMenu(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContextMenuItem({ icon, label, onClick, danger, onClose }: { icon: React.ReactNode, label: string, onClick: () => void, danger?: boolean, onClose?: () => void }) {
  return (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        onClick();
        if (onClose) {
          onClose();
        }
      }}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all",
        danger ? "text-red-500 hover:bg-red-500/10" : "text-slate-400 hover:bg-slate-500/10 hover:text-slate-600 dark:hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function NavItem({ icon, label, active, onClick, theme }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, theme: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group",
        active 
          ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
          : "text-slate-400 hover:bg-blue-500/5 hover:text-blue-500"
      )}
    >
      <span className={cn("transition-colors", active ? "text-white" : "text-slate-500 group-hover:text-blue-500")}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function ThumbImage({ photo, className, alt }: { photo: Photo, className?: string, alt?: string }) {
  return <img src={photo.thumbnailUrl} className={className} alt={alt || photo.fileName} loading="lazy" />;
}

const PhotoCard = React.memo(({ photo, mode, onClick, theme, onToggleFavorite, onDeletePhoto }: { photo: Photo, mode: 'grid' | 'list', onClick: () => void, theme: string, onToggleFavorite: (id: string) => void, onDeletePhoto: (id: string) => void }) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('photoId', photo.id);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(photo.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this photo?')) {
      onDeletePhoto(photo.id);
    }
  };

  if (mode === 'list') {
    return (
      <div 
        draggable
        onDragStart={handleDragStart}
        className="group"
      >
        <motion.div 
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onClick}
          className="flex items-center gap-6 p-4 glass-card rounded-2xl cursor-pointer"
        >
          <ThumbImage photo={photo} className="w-20 h-20 object-cover rounded-xl shadow-sm" alt={photo.fileName} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-lg truncate">{photo.fileName}</h3>
              {photo.fileName.toLowerCase().endsWith('.raf') && (
                <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[8px] font-black uppercase tracking-widest rounded-md">RAW</span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
              <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-500 px-2 py-1 rounded-md"><Camera className="w-3.5 h-3.5" /> {photo.cameraModel}</span>
              <span className="px-2 py-1 bg-slate-500/10 text-slate-600 dark:text-slate-300 rounded-md font-black text-[10px] uppercase tracking-widest">
                {FILM_SHORT_CODES[photo.filmMode || ''] || '??'}
              </span>
              <span>{new Date(photo.dateTime || '').toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleToggleFavorite} className="p-2 hover:bg-red-500/10 rounded-xl transition-all">
              <Heart className={cn("w-5 h-5 transition-all", photo.isFavorite ? "text-red-500 fill-red-500" : "text-slate-300")} />
            </button>
            <button onClick={handleDelete} className="p-2 hover:bg-red-500/10 rounded-xl transition-all">
              <Trash2 className="w-5 h-5 text-slate-300 hover:text-red-500 transition-all" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      className="group"
    >
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -8, scale: 1.02 }}
        onClick={onClick}
        className="relative glass-card rounded-3xl overflow-hidden cursor-pointer"
      >
        <div className="aspect-video overflow-hidden relative">
          <ThumbImage
            photo={photo}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            alt={photo.fileName}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
            <p className="text-sm font-bold truncate text-white">{photo.fileName}</p>
            <p className="text-xs text-slate-300 mt-1">{photo.cameraModel}</p>
          </div>
          {photo.filmMode && (
            <div className="absolute top-4 left-4 px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">
                {FILM_SHORT_CODES[photo.filmMode] || photo.filmMode}
              </span>
              {photo.fileName.toLowerCase().endsWith('.raf') && (
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" title="RAW File" />
              )}
            </div>
          )}
          <button 
            onClick={handleToggleFavorite}
            className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-xl rounded-2xl border border-white/30 hover:bg-white/40 transition-all"
          >
            <Heart className={cn("w-4 h-4 transition-all", photo.isFavorite ? "text-red-500 fill-red-500" : "text-white")} />
          </button>
        </div>
        <div className="p-4 flex flex-col items-start gap-2">
          <div className="w-full flex items-center justify-between gap-4">
            <h3 className="font-bold text-sm truncate text-slate-600 dark:text-slate-300">{photo.fileName}</h3>
            <button 
              onClick={handleDelete}
              className="p-2 hover:bg-red-500/10 rounded-xl transition-all group/delete"
            >
              <Trash2 className="w-4 h-4 text-slate-300 group-hover/delete:text-red-500 transition-all" />
            </button>
          </div>
          {(photo.tags?.length || photo.filmMode) && (
            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0 w-full">
              {photo.tags?.slice(0, 2).map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-md text-[8px] font-black uppercase tracking-widest border border-blue-500/20">
                  {tag}
                </span>
              ))}
              {photo.tags && photo.tags.length > 2 && (
                <span className="text-[8px] font-black text-slate-400">+{photo.tags.length - 2}</span>
              )}
              {!photo.tags?.length && photo.filmMode && (
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 truncate">{photo.filmMode}</span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
});

function PhotoDetailModal({ photo, onClose, recipes, folders, onRecognize, theme, allTags, onExport, onUpdatePhoto, onDeletePhoto, onAddTag }: { photo: Photo, onClose: () => void, recipes: Recipe[], folders: Folder[], onRecognize: (p: Photo) => void, theme: string, allTags: Tag[], onExport: () => void, onUpdatePhoto: (id: string, updates: Partial<Photo>) => void, onDeletePhoto: (id: string) => void, onAddTag: (tag: Tag) => void }) {
  const [isFavorite, setIsFavorite] = useState(photo.isFavorite);
  const [isHidden, setIsHidden] = useState(photo.isHidden);
  const [rating, setRating] = useState(photo.rating);
  const [photoTags, setPhotoTags] = useState<string[]>(photo.tags || []);
  const [newTag, setNewTag] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState(photo.recipeId || '');

  const folder = folders.find(f => f.id === photo.folderId);
  const currentRecipe = recipes.find(r => r.id === selectedRecipeId);

  const handleToggleFavorite = async () => {
    const newVal = !isFavorite;
    setIsFavorite(newVal);
    onUpdatePhoto(photo.id, { isFavorite: newVal });
  };

  const handleToggleHidden = async () => {
    const newVal = !isHidden;
    setIsHidden(newVal);
    onUpdatePhoto(photo.id, { isHidden: newVal });
    if (newVal) onClose();
  };

  const handleRating = async (r: number) => {
    setRating(r);
    onUpdatePhoto(photo.id, { rating: r });
  };

  const handleAddTag = async (tagName: string) => {
    const cleanTag = tagName.trim();
    if (!cleanTag || photoTags.includes(cleanTag)) return;
    const updatedTags = [...photoTags, cleanTag];
    setPhotoTags(updatedTags);
    setNewTag('');
    onUpdatePhoto(photo.id, { tags: updatedTags });
    
    if (!allTags.some(t => t.name === cleanTag)) {
      onAddTag({
        id: `t-${Date.now()}`,
        name: cleanTag,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        ownerId: photo.ownerId
      });
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = photoTags.filter(t => t !== tagToRemove);
    setPhotoTags(updatedTags);
    onUpdatePhoto(photo.id, { tags: updatedTags });
  };

  const handleRecipeChange = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    onUpdatePhoto(photo.id, { recipeId });
  };

  const handleDelete = async () => {
    onDeletePhoto(photo.id);
    onClose();
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10 bg-black/60 backdrop-blur-xl"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="glass w-full max-w-6xl h-full max-h-[90vh] rounded-[2.5rem] overflow-hidden flex flex-col lg:flex-row shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Image Preview */}
          <div className="flex-1 bg-black/20 flex items-center justify-center relative group">
            <img src={`file://${photo.filePath}`} className="max-w-full max-h-full object-contain" alt={photo.fileName} />
            {photo.fileName.toLowerCase().endsWith('.raf') && (
              <div className="absolute top-8 right-8 px-4 py-2 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                RAW / RAF
              </div>
            )}
            <button 
              onClick={onClose}
              className="absolute top-8 left-8 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-2xl transition-all border border-white/20 text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Info Panel */}
          <div className="w-full lg:w-[28rem] flex flex-col bg-[var(--bg-primary)]/50 backdrop-blur-2xl border-l border-[var(--border-color)]">
            <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-black tracking-tight truncate">{photo.fileName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(photo.dateTime || '').toLocaleString()}</p>
                  <span className="text-slate-600">•</span>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                    <HardDrive className="w-3 h-3" />
                    {folder?.name || 'Uncategorized'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={onExport}
                  className="p-2.5 bg-slate-500/5 hover:bg-orange-500/10 text-slate-400 hover:text-orange-500 rounded-xl transition-all border border-transparent hover:border-orange-500/20"
                  title="Export Recipe"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2.5 bg-slate-500/5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                  title="Delete Photo"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Quick Actions */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1 bg-slate-500/5 p-1.5 rounded-xl border border-[var(--border-color)]">
                  {[1, 2, 3, 4, 5].map(r => (
                    <button key={r} onClick={() => handleRating(r)} className="p-1">
                      <Star className={cn("w-4 h-4 transition-all", r <= rating ? "text-yellow-500 fill-yellow-500" : "text-slate-300 hover:text-yellow-500/50")} />
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleToggleFavorite}
                    className={cn("p-2 rounded-lg transition-all border", isFavorite ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-white/5 text-slate-400 border-transparent hover:text-red-500")}
                  >
                    <Heart className={cn("w-4 h-4", isFavorite && "fill-red-500")} />
                  </button>
                </div>
              </div>

              {/* Film Recipe Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Associated Recipe</h3>
                  {currentRecipe && (
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <div className="space-y-3">
                  <CustomSelect 
                    value={selectedRecipeId}
                    onChange={handleRecipeChange}
                    placeholder="Select a recipe..."
                    options={recipes.map(r => ({ label: r.name, value: r.id }))}
                    className="!rounded-xl"
                  />
                  {currentRecipe && (
                    <div className="p-4 bg-slate-500/5 rounded-2xl border border-[var(--border-color)] flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                        <FlaskConical className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black truncate">{currentRecipe.name}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{currentRecipe.filmMode}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Recognition Button */}
              <button 
                onClick={() => onRecognize(photo)}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Sparkles className="w-4 h-4" />
                AI Smart Recognition
              </button>

              {/* Parameters Section */}
              <div className="space-y-8">
                {/* EXIF Metadata */}
                <div className="space-y-4">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">EXIF Metadata</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <CompactExif icon={<Camera className="w-3 h-3" />} value={photo.cameraModel} />
                    <CompactExif icon={<ArrowUpDown className="w-3 h-3" />} value={photo.fNumber} />
                    <CompactExif icon={<Clock className="w-3 h-3" />} value={photo.exposureTime} />
                    <CompactExif icon={<LayoutGrid className="w-3 h-3" />} value={photo.iso?.toString()} />
                    <CompactExif icon={<ArrowUpDown className="w-3 h-3" />} value={photo.focalLength} />
                    <CompactExif icon={<Info className="w-3 h-3" />} value={photo.lensModel} />
                  </div>
                </div>

                {/* Film Settings */}
                <div className="space-y-4">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Film Settings</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <FilmTag label="Mode" value={photo.filmMode} primary />
                    <FilmTag label="WB" value={photo.whiteBalance} />
                    <FilmTag label="DR" value={photo.dynamicRange} />
                    <FilmTag label="Sharp" value={photo.sharpness} />
                    <FilmTag label="Color" value={photo.saturation} />
                    <FilmTag label="Cont." value={photo.contrast} />
                    <FilmTag label="Clar." value={photo.clarity} />
                    <FilmTag label="Shad." value={photo.shadowTone} />
                    <FilmTag label="High." value={photo.highlightTone} />
                  </div>
                </div>
              </div>

              {/* Tags Section */}
              <div className="space-y-4 pt-6 border-t border-[var(--border-color)]">
                <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {photoTags.map(tag => (
                    <span 
                      key={tag} 
                      className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-500/20 group/tag"
                    >
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 transition-colors">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <input 
                    type="text"
                    placeholder="+"
                    className="w-12 bg-slate-500/5 border border-[var(--border-color)] rounded-lg px-2 py-1 text-[9px] font-bold focus:outline-none focus:w-24 transition-all"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag(newTag)}
                  />
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-[var(--border-color)] flex flex-col gap-4">
              <div className="flex gap-4">
                <button 
                  onClick={() => console.log('Locating file:', photo.filePath)}
                  className="flex-1 py-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 border border-[var(--border-color)]"
                >
                  <Navigation className="w-5 h-5" />
                  Locate File
                </button>
                <button 
                  onClick={() => console.log('Opening original:', photo.filePath)}
                  className="flex-1 py-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 border border-[var(--border-color)]"
                >
                  <ExternalLink className="w-5 h-5" />
                  Original
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <ConfirmModal 
            title="Delete Photo"
            message={`Are you sure you want to delete "${photo.fileName}"? This action cannot be undone.`}
            confirmLabel="Delete"
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
            variant="danger"
          />
        )}
      </AnimatePresence>
    </>
  );
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, variant = 'primary' }: { title: string, message: string, confirmLabel: string, onConfirm: () => void, onCancel: () => void, variant?: 'primary' | 'danger' }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl" onClick={onCancel}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="glass w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight">{title}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-10 space-y-8">
          <p className="text-sm font-bold text-slate-400 leading-relaxed">{message}</p>
          <div className="flex gap-4">
            <button 
              onClick={onCancel}
              className="flex-1 py-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl text-sm font-black transition-all border border-[var(--border-color)]"
            >
              Cancel
            </button>
            <button 
              onClick={onConfirm}
              className={cn(
                "flex-1 py-4 text-white rounded-2xl text-sm font-black transition-all shadow-lg",
                variant === 'danger' ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" : "bg-blue-500 hover:bg-blue-600 shadow-blue-500/20"
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function CompactExif({ icon, value }: { icon: React.ReactNode, value?: string }) {
  return (
    <div className="bg-slate-500/5 p-2 rounded-xl border border-[var(--border-color)] flex items-center gap-2 min-w-0">
      <div className="text-slate-400 flex-shrink-0">{icon}</div>
      <p className="text-[10px] font-black truncate">{value || '-'}</p>
    </div>
  );
}

function ExifItem({ icon, label, value }: { icon: React.ReactNode, label: string, value?: string }) {
  return (
    <div className="bg-slate-500/5 p-4 rounded-2xl border border-[var(--border-color)] space-y-2">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-sm font-black truncate">{value || 'N/A'}</p>
    </div>
  );
}

function FilmTag({ label, value, primary }: { label: string, value?: string, primary?: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black border transition-all",
      primary 
        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" 
        : "bg-slate-500/5 text-slate-500 border-[var(--border-color)]"
    )}>
      <span className="uppercase tracking-widest opacity-60">{label}</span>
      <span className="uppercase tracking-widest">{value || '0'}</span>
    </div>
  );
}

function ImportModal({ onClose, user, theme, setFolders, setPhotos, initialType, activeFolderId, folders }: { onClose: () => void, user: User | null, theme: string, setFolders: React.Dispatch<React.SetStateAction<Folder[]>>, setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>, initialType: 'files' | 'folders', activeFolderId: string | null, folders: Folder[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedLocalPaths, setSelectedLocalPaths] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [folderName, setFolderName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [selectedDestFolderId, setSelectedDestFolderId] = useState<string | null>(activeFolderId);
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [importMode, setImportMode] = useState<'create' | 'import'>(initialType === 'folders' ? 'create' : 'import');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles);
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles);
      // Automatically set folder name from the first file's path if available
      const firstFile = selectedFiles[0] as any;
      if (firstFile.webkitRelativePath) {
        const pathParts = firstFile.webkitRelativePath.split('/');
        if (pathParts.length > 1) {
          setFolderName(pathParts[0]);
        }
      }
    }
  };

  const handleImport = async () => {
    if (importMode === 'import' && files.length === 0 && selectedLocalPaths.length === 0 && !folderPath) return;
    if (importMode === 'create' && !folderName) return;

    setImporting(true);
    setProgress(0);

    let targetFolderId = selectedDestFolderId;

    // Prefer local Electron APIs for folder/file indexing and DB write.
    if (window.electronAPI) {
      try {
        if (folderName) {
          const createdFolder = await window.electronAPI.createFolder({
            name: folderName,
            path: folderPath || null,
            parentId: selectedDestFolderId || null,
            includeSubfolders,
            photoCount: 0,
            lastSynced: Date.now(),
            type: folderPath ? 'physical' : 'logical',
          });
          targetFolderId = String(createdFolder?.id || targetFolderId || '');
          if (createdFolder?.id) {
            const mapped = convertDbFolderToFolder(createdFolder);
            setFolders(prev => {
              if (prev.some((f) => f.id === mapped.id)) return prev;
              return [...prev, mapped];
            });
          }
        }

        if (importMode === 'create') {
          onClose();
          return;
        }

        if (folderPath) {
          await window.electronAPI.scanFolder(folderPath, true);
        } else if (selectedLocalPaths.length > 0) {
          await window.electronAPI.scanFiles(selectedLocalPaths);
        }

        // Force-refresh first page after import/scan so UI reflects new photos immediately.
        const refreshed = await window.electronAPI.getPhotosPage(1, 120).catch(() => null);
        if (refreshed?.items) {
          setPhotos((refreshed.items || []).map(convertDbPhotoToPhoto));
        }
        onClose();
        return;
      } catch (err) {
        console.error('Electron import failed, fallback to browser mode:', err);
      } finally {
        setImporting(false);
      }
    }

    const newPhotos: Photo[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const metadata = await (exifr as any).parse(file, {
          tiff: true,
          xmp: true,
          icc: true,
          jfif: true,
          ihdr: true,
          fujifilm: true
        }).catch(() => ({}));
        
        // Extract thumbnail
        let thumbnailUrl = '';
        const isRaf = file.name.toLowerCase().endsWith('.raf');
        
        if (isRaf) {
          try {
            const thumb = await (exifr as any).thumbnail(file);
            if (thumb) {
              // Convert Uint8Array/Blob to base64 for storage (following existing pattern)
              const blob = new Blob([thumb], { type: 'image/jpeg' });
              thumbnailUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(blob);
              });
            }
          } catch (e) {
            console.warn('Could not extract thumbnail from RAF:', file.name, e);
          }
        }

        if (!thumbnailUrl) {
          // Fallback for JPG or if RAF thumbnail extraction failed
          const reader = new FileReader();
          thumbnailUrl = await new Promise<string>((resolve) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
        }

        const photoData: Photo = {
          id: `p-${Date.now()}-${i}`,
          fileName: file.name,
          filePath: file.name,
          thumbnailUrl: thumbnailUrl,
          cameraModel: metadata?.Model || 'Unknown Camera',
          lensModel: metadata?.LensModel || 'Unknown Lens',
          dateTime: metadata?.DateTimeOriginal?.toISOString() || new Date().toISOString(),
          exposureTime: metadata?.ExposureTime ? `1/${Math.round(1/metadata.ExposureTime)}` : 'N/A',
          fNumber: metadata?.FNumber ? `f/${metadata.FNumber}` : 'N/A',
          iso: metadata?.ISO || 0,
          focalLength: metadata?.FocalLength ? `${metadata.FocalLength}mm` : 'N/A',
          filmMode: metadata?.FilmMode || 'Provia/Standard',
          whiteBalance: metadata?.WhiteBalance || 'Auto',
          dynamicRange: metadata?.DynamicRange || '100%',
          sharpness: metadata?.Sharpness?.toString() || '0',
          saturation: metadata?.Saturation?.toString() || '0',
          contrast: metadata?.Contrast?.toString() || '0',
          clarity: metadata?.Clarity?.toString() || '0',
          shadowTone: metadata?.ShadowTone?.toString() || '0',
          highlightTone: metadata?.HighlightTone?.toString() || '0',
          noiseReduction: metadata?.NoiseReduction?.toString() || '0',
          grainEffect: metadata?.GrainEffect || 'Off',
          colorChromeEffect: metadata?.ColorChromeEffect || 'Off',
          colorChromeEffectBlue: metadata?.ColorChromeEffectBlue || 'Off',
          isFavorite: false,
          isHidden: false,
          rating: 0,
          tags: [],
          ownerId: user?.uid || 'demo',
          recipeId: '',
          folderId: targetFolderId || ''
        };

        newPhotos.push(photoData);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (err) {
        console.error('Error importing file:', file.name, err);
      }
    }

    setPhotos(prev => [...prev, ...newPhotos]);
    setImporting(false);
    onClose();
  };

  const handlePickLocal = async () => {
    if (!window.electronAPI) return;
    if (initialType === 'files') {
      const filePaths = await window.electronAPI.pickFiles();
      if (filePaths && filePaths.length > 0) {
        setSelectedLocalPaths(filePaths);
      }
      return;
    }
    const pickedFolder = await window.electronAPI.pickFolder();
    if (pickedFolder) {
      setFolderPath(pickedFolder);
      setFolderName(pickedFolder.split(/[\\/]/).pop() || pickedFolder);
      setSelectedLocalPaths([pickedFolder]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="glass w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
              {importMode === 'import' ? <Plus className="w-6 h-6 text-blue-500" /> : <FolderIcon className="w-6 h-6 text-blue-500" />}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{importMode === 'import' ? 'Import System Folder' : 'Create Logical Folder'}</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {importMode === 'import' ? 'Select a directory to import JPG and RAF photos' : 'Add a new folder to your library structure'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-10 space-y-8">
          {initialType === 'folders' && (
            <div className="flex p-1 bg-slate-500/5 rounded-xl border border-[var(--border-color)]">
              <button 
                onClick={() => setImportMode('create')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  importMode === 'create' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Create Only
              </button>
              <button 
                onClick={() => setImportMode('import')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  importMode === 'import' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Import System
              </button>
            </div>
          )}

          {importMode === 'create' ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Folder Name</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold"
                  placeholder="e.g. My Fuji Photos"
                  value={folderName}
                  onChange={e => setFolderName(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parent Folder</label>
                <CustomSelect 
                  value={selectedDestFolderId || ''}
                  onChange={(val) => setSelectedDestFolderId(val || null)}
                  placeholder="Root Library"
                  options={folders.map(f => ({ label: f.name, value: f.id }))}
                />
              </div>
              <button 
                onClick={handleImport}
                disabled={!folderName}
                className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <Check className="w-5 h-5" />
                Create Folder
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <div 
                className={cn(
                  "border-4 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center space-y-6 transition-all cursor-pointer",
                  (files.length > 0 || selectedLocalPaths.length > 0) ? "border-blue-500/30 bg-blue-500/5" : "border-slate-500/10 hover:border-blue-500/30 hover:bg-blue-500/5"
                )}
                onClick={() => {
                  if (window.electronAPI) {
                    void handlePickLocal();
                  } else {
                    initialType === 'files' ? fileInputRef.current?.click() : folderInputRef.current?.click();
                  }
                }}
              >
                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center">
                  {initialType === 'files' ? <Plus className="w-10 h-10 text-blue-500" /> : <FolderIcon className="w-10 h-10 text-blue-500" />}
                </div>
                <div className="text-center space-y-2">
                  <p className="font-black text-xl tracking-tight">
                    {(selectedLocalPaths.length > 0 || files.length > 0)
                      ? `${selectedLocalPaths.length || files.length} items selected`
                      : `Click to select ${initialType === 'files' ? 'photos' : 'folder'}`}
                  </p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {initialType === 'files' ? 'Supports JPG and RAF formats' : 'All photos in the folder will be imported'}
                  </p>
                </div>
                <input 
                  type="file" 
                  multiple 
                  accept=".jpg,.jpeg,.raf" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
                <input 
                  type="file" 
                  {...({ webkitdirectory: "", directory: "" } as any)}
                  className="hidden" 
                  ref={folderInputRef}
                  onChange={handleFolderSelect}
                />
              </div>

              {(files.length > 0 || selectedLocalPaths.length > 0 || folderPath) && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-slate-400">{selectedLocalPaths.length || files.length} files ready to import</span>
                    <button onClick={() => { setFiles([]); setSelectedLocalPaths([]); setFolderPath(''); }} className="text-red-500 hover:text-red-600">Clear</button>
                  </div>
                  
                  {importing ? (
                    <div className="space-y-4">
                      <div className="h-3 bg-slate-500/10 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Importing... {progress}%</p>
                    </div>
                  ) : (
                    <button 
                      onClick={handleImport}
                      className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Start Import
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SyncFolderModal({ onClose, folderId, folders }: { onClose: () => void, folderId: string, folders: Folder[] }) {
  const folder = folders.find(f => f.id === folderId);
  const [scanning, setScanning] = useState(true);
  const [message, setMessage] = useState('Scanning folder...');

  useEffect(() => {
    const run = async () => {
      if (!folder?.path || folder.type !== 'physical' || !window.electronAPI) {
        setMessage('Only physical folders can be refreshed.');
        setScanning(false);
        return;
      }
      try {
        await window.electronAPI.scanFolder(folder.path, true);
        setMessage('Folder refreshed successfully.');
      } catch (err) {
        setMessage(`Refresh failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setScanning(false);
      }
    };
    void run();
  }, [folder?.path, folder?.type]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="glass w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
              <RefreshCw className={cn("w-6 h-6 text-blue-500", scanning && "animate-spin")} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">Syncing Folder</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{folder?.name || 'Unknown'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-10 space-y-6">
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">{message}</p>
          <button
            onClick={onClose}
            className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-black shadow-xl shadow-blue-500/20 transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function TimelineApiView({ onPhotoClick, onSearchDate }: {
  onPhotoClick: (p: Photo) => void,
  onSearchDate: (date: string) => void
}) {
  const [groups, setGroups] = useState<any[]>([]);
  const [groupPage, setGroupPage] = useState(1);
  const [hasMoreGroups, setHasMoreGroups] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [dayPhotos, setDayPhotos] = useState<Record<string, Photo[]>>({});
  const [dayPages, setDayPages] = useState<Record<string, number>>({});
  const [dayHasMore, setDayHasMore] = useState<Record<string, boolean>>({});
  const GROUP_PAGE_SIZE = 60;
  const DAY_PAGE_SIZE = 80;

  useEffect(() => {
    const loadInitial = async () => {
      if (!window.electronAPI?.getTimelineGroups) return;
      setLoadingGroups(true);
      try {
        const res = await window.electronAPI.getTimelineGroups(1, GROUP_PAGE_SIZE);
        setGroups(res?.items || []);
        setGroupPage(1);
        const totalPages = res?.totalPages || 1;
        setHasMoreGroups(1 < totalPages);
      } finally {
        setLoadingGroups(false);
      }
    };
    void loadInitial();
  }, []);

  const loadMoreGroups = async () => {
    if (loadingGroups || !hasMoreGroups || !window.electronAPI?.getTimelineGroups) return;
    setLoadingGroups(true);
    try {
      const next = groupPage + 1;
      const res = await window.electronAPI.getTimelineGroups(next, GROUP_PAGE_SIZE);
      setGroups(prev => [...prev, ...(res?.items || [])]);
      setGroupPage(next);
      const totalPages = res?.totalPages || next;
      setHasMoreGroups(next < totalPages);
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadDayPhotos = async (dayKey: string, page = 1) => {
    if (!window.electronAPI?.getTimelinePhotosByDay) return;
    const res = await window.electronAPI.getTimelinePhotosByDay(dayKey, page, DAY_PAGE_SIZE);
    const items = (res?.items || []).map(convertDbPhotoToPhoto);
    setDayPhotos(prev => ({ ...prev, [dayKey]: page === 1 ? items : [...(prev[dayKey] || []), ...items] }));
    setDayPages(prev => ({ ...prev, [dayKey]: page }));
    const totalPages = res?.totalPages || page;
    setDayHasMore(prev => ({ ...prev, [dayKey]: page < totalPages }));
  };

  const toggleDay = (dayKey: string) => {
    const next = new Set(expandedDays);
    if (next.has(dayKey)) {
      next.delete(dayKey);
    } else {
      next.add(dayKey);
      if (!dayPhotos[dayKey]) {
        void loadDayPhotos(dayKey, 1);
      }
    }
    setExpandedDays(next);
  };

  if (groups.length === 0 && !loadingGroups) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6 text-slate-400">
        <div className="w-20 h-20 bg-slate-500/5 rounded-full flex items-center justify-center">
          <Clock className="w-10 h-10 opacity-20" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-black text-lg">No Timeline Data</p>
          <p className="text-xs font-bold uppercase tracking-widest opacity-60">Import photos to see your journey</p>
        </div>
      </div>
    );
  }

  return (
    <Virtuoso
      data={groups}
      endReached={() => {
        void loadMoreGroups();
      }}
      itemContent={(index, group) => {
        const dayKey = group.day_key;
        const isExpanded = expandedDays.has(dayKey);
        const displayDate = new Date(`${dayKey}T00:00:00`).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
        const photosInDay = dayPhotos[dayKey] || [];

        return (
          <div className="py-6 space-y-4 border-b border-[var(--border-color)]">
            <button
              onClick={() => toggleDay(dayKey)}
              className="w-full flex items-center justify-between text-left hover:bg-slate-500/5 rounded-xl px-3 py-2 transition-all"
            >
              <div>
                <h3 className="text-lg font-black tracking-tight">{displayDate}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{group.photo_count} photos</p>
              </div>
              <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
            </button>

            {isExpanded && (
              <div className="space-y-3 px-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {photosInDay.map((photo) => (
                    <button key={photo.id} className="group text-left" onClick={() => onPhotoClick(photo)}>
                      <ThumbImage photo={photo} alt={photo.fileName} className="w-full aspect-square object-cover rounded-xl" />
                      <p className="mt-1 text-[10px] font-bold truncate opacity-70 group-hover:opacity-100">{photo.fileName}</p>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  {dayHasMore[dayKey] && (
                    <button
                      onClick={() => {
                        void loadDayPhotos(dayKey, (dayPages[dayKey] || 1) + 1);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-500/10 text-xs font-black uppercase tracking-widest hover:bg-slate-500/20"
                    >
                      Load More
                    </button>
                  )}
                  <button
                    onClick={() => onSearchDate(dayKey)}
                    className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-500 text-xs font-black uppercase tracking-widest hover:bg-blue-500/20"
                  >
                    Filter This Date
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      }}
      components={{
        Footer: () => (
          loadingGroups ? (
            <div className="py-6 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Loading timeline...</div>
          ) : null
        )
      }}
    />
  );
}

function TimelineView({ photos, onPhotoClick, onSearchDate }: { 
  photos: Photo[], 
  onPhotoClick: (p: Photo) => void, 
  onSearchDate: (date: string) => void 
}) {
  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [dateLimits, setDateLimits] = useState<Record<string, number>>({});

  const INITIAL_GRID_LIMIT = 24;
  const LOAD_MORE_STEP = 24;

  // Group photos by Year, then by Date
  const groupedByYear = useMemo(() => {
    return photos.reduce((acc, p) => {
      const d = new Date(p.dateTime || '');
      const year = d.getFullYear().toString();
      // 使用YYYY-MM-DD格式作为日期键，确保按天正确分组
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      if (!acc[year]) acc[year] = {};
      if (!acc[year][dateKey]) acc[year][dateKey] = [];
      acc[year][dateKey].push(p);
      return acc;
    }, {} as Record<string, Record<string, Photo[]>>);
  }, [photos]);

  const sortedYears = useMemo(() => Object.keys(groupedByYear).sort((a, b) => b.localeCompare(a)), [groupedByYear]);

  // Initialize collapsedDates: only the very first date of the timeline is expanded by default
  useEffect(() => {
    const newCollapsed = new Set<string>();
    let isFirst = true;
    sortedYears.forEach(year => {
      const dates = Object.keys(groupedByYear[year]).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      dates.forEach(date => {
        if (isFirst) {
          isFirst = false;
        } else {
          newCollapsed.add(date);
        }
      });
    });
    setCollapsedDates(newCollapsed);
  }, [sortedYears, groupedByYear]);

  const toggleYearCollapse = (year: string) => {
    const newCollapsed = new Set(collapsedYears);
    if (newCollapsed.has(year)) {
      newCollapsed.delete(year);
    } else {
      newCollapsed.add(year);
    }
    setCollapsedYears(newCollapsed);
  };

  const toggleDateCollapse = (date: string) => {
    const newCollapsed = new Set(collapsedDates);
    if (newCollapsed.has(date)) {
      newCollapsed.delete(date);
    } else {
      newCollapsed.add(date);
    }
    setCollapsedDates(newCollapsed);
  };

  const toggleDateExpand = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
      if (!dateLimits[date]) {
        setDateLimits(prev => ({ ...prev, [date]: INITIAL_GRID_LIMIT }));
      }
    }
    setExpandedDates(newExpanded);
  };

  const loadMorePhotos = (date: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDateLimits(prev => ({ ...prev, [date]: (prev[date] || INITIAL_GRID_LIMIT) + LOAD_MORE_STEP }));
  };

  const flattenedTimeline = useMemo(() => {
    const list: (
      | { type: 'year', year: string, count: number }
      | { type: 'date', date: string, items: Photo[] }
    )[] = [];
    
    sortedYears.forEach(year => {
      const isYearCollapsed = collapsedYears.has(year);
      const dateGroups = groupedByYear[year];
      const sortedDates = Object.keys(dateGroups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      list.push({ 
        type: 'year', 
        year, 
        count: Object.values(dateGroups).flat().length 
      });

      if (!isYearCollapsed) {
        sortedDates.forEach(date => {
          list.push({ 
            type: 'date', 
            date, 
            items: dateGroups[date] 
          });
        });
      }
    });
    return list;
  }, [sortedYears, groupedByYear, collapsedYears]);

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6 text-slate-400">
        <div className="w-20 h-20 bg-slate-500/5 rounded-full flex items-center justify-center">
          <Clock className="w-10 h-10 opacity-20" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-black text-lg">No Timeline Data</p>
          <p className="text-xs font-bold uppercase tracking-widest opacity-60">Import photos to see your journey</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* Main Timeline Line */}
      <div className="absolute left-12 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-slate-500/10 to-transparent z-0" />

      <div className="flex justify-end pr-8 pt-8 relative z-10">
        <button 
          onClick={() => {
            if (collapsedYears.size === sortedYears.length) {
              setCollapsedYears(new Set());
            } else {
              setCollapsedYears(new Set(sortedYears));
            }
          }}
          className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-600 transition-colors flex items-center gap-2 bg-blue-500/5 px-4 py-2 rounded-full border border-blue-500/10"
        >
          {collapsedYears.size === sortedYears.length ? 'Expand All Years' : 'Collapse All Years'}
        </button>
      </div>

      <Virtuoso
        data={flattenedTimeline}
        itemContent={(index, item) => {
          if (item.type === 'year') {
            const isYearCollapsed = collapsedYears.has(item.year);
            return (
              <div className="relative pl-8 pr-8 py-8 bg-[var(--bg-primary)]">
                <div 
                  className="flex items-center gap-6 group cursor-pointer" 
                  onClick={() => toggleYearCollapse(item.year)}
                >
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-4 border-blue-500 shadow-lg shadow-blue-500/20 z-10" />
                  <div className="flex items-baseline gap-4">
                    <h2 className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">{item.year}</h2>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {item.count} Photos
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-slate-500/10 to-transparent" />
                  <motion.div
                    animate={{ rotate: isYearCollapsed ? -90 : 0 }}
                    className="p-2 hover:bg-slate-500/5 rounded-xl transition-all"
                  >
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  </motion.div>
                </div>
              </div>
            );
          }

          const date = item.date;
          const items = item.items;
          const isExpanded = expandedDates.has(date);
          const isDateCollapsed = collapsedDates.has(date);
          // 将YYYY-MM-DD格式的日期转换为更友好的显示格式
          const displayDate = new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

          return (
            <div className="relative pl-14 pr-8 py-6 bg-[var(--bg-primary)]">
              <div className="space-y-8">
                <div 
                  className="flex items-center gap-4 cursor-pointer group/date"
                  onClick={() => toggleDateCollapse(date)}
                >
                  <div className="w-3 h-3 rounded-full bg-blue-500/30 group-hover/date:bg-blue-500 transition-colors" />
                  <div className="flex flex-col">
                    <h3 className="text-lg font-black tracking-tight text-slate-600 dark:text-slate-300 group-hover/date:text-blue-500 transition-colors">{displayDate}</h3>
                    {(() => {
                      const locations = Array.from(new Set(items.map(p => p.location).filter(Boolean)));
                      if (locations.length > 0) {
                        return (
                          <div className="flex items-center gap-2 mt-1">
                            <Target className="w-3 h-3 text-blue-500/60" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]">
                              {locations.join(' • ')}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-slate-500/5 rounded-full border border-[var(--border-color)]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {items.length} Photos
                      </span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        // 直接使用date变量，因为它已经是YYYY-MM-DD格式
                        onSearchDate(date);
                      }}
                      className="p-2 hover:bg-blue-500/10 rounded-xl text-blue-500 transition-all group/jump"
                      title="View in Gallery"
                    >
                      <ExternalLink className="w-4 h-4 group-hover/jump:scale-110 transition-transform" />
                    </button>
                  </div>
                  <motion.div
                    animate={{ rotate: isDateCollapsed ? -90 : 0 }}
                    className="opacity-0 group-hover/date:opacity-100 transition-opacity"
                  >
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </motion.div>
                </div>

                <AnimatePresence mode="wait">
                  {!isDateCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <AnimatePresence mode="wait">
                        {!isExpanded ? (
                          <motion.div
                            key="stack"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative h-72 w-full max-w-md cursor-pointer group ml-6"
                            onClick={() => toggleDateExpand(date)}
                          >
                            {items.slice(0, 4).map((photo, idx) => (
                              <motion.div
                                key={photo.id}
                                className="absolute inset-0 rounded-[2.5rem] overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl"
                                animate={{ 
                                  zIndex: 4 - idx,
                                  x: idx * 24,
                                  y: idx * 14,
                                  rotate: idx === 0 ? 0 : idx === 1 ? 8 : idx === 2 ? -8 : 4,
                                  scale: 1 - idx * 0.05,
                                }}
                                whileHover={{
                                  x: idx * 36,
                                  y: idx * 20,
                                  rotate: idx === 0 ? -2 : idx === 1 ? 15 : idx === 2 ? -15 : 8,
                                  transition: { type: "spring", stiffness: 300, damping: 20 }
                                }}
                              >
                                <ThumbImage photo={photo} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={photo.fileName} />
                                {idx === 0 && (
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-10">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                      <span className="text-white text-[10px] font-black uppercase tracking-widest opacity-80">Click to reveal album</span>
                                    </div>
                                    <h4 className="text-white text-2xl font-black tracking-tight">{items.length} Photos</h4>
                                    <p className="text-white/40 text-[8px] font-bold uppercase tracking-widest mt-2">{items[0].filmMode} • {items[0].cameraModel}</p>
                                  </div>
                                )}
                              </motion.div>
                            ))}
                            <div className="absolute -inset-10 bg-blue-500/5 blur-[100px] rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="grid"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 30 }}
                            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 ml-6"
                          >
                            {items.slice(0, dateLimits[date] || INITIAL_GRID_LIMIT).map((photo, pIdx) => (
                              <motion.div
                                key={photo.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: pIdx * 0.01 }}
                                whileHover={{ scale: 1.05, y: -8 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onPhotoClick(photo)}
                                className="aspect-square rounded-3xl overflow-hidden cursor-pointer border border-[var(--border-color)] shadow-sm relative group bg-slate-500/5"
                              >
                                <ThumbImage photo={photo} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={photo.fileName} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                  <p className="text-[8px] font-black text-white truncate uppercase tracking-widest">{photo.filmMode}</p>
                                </div>
                                <div className="absolute top-3 right-3 p-2 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Eye className="w-3 h-3 text-white" />
                                </div>
                              </motion.div>
                            ))}
                            
                            {items.length > (dateLimits[date] || INITIAL_GRID_LIMIT) && (
                              <motion.button
                                whileHover={{ scale: 1.05, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => loadMorePhotos(date, e)}
                                className="aspect-square rounded-3xl border-2 border-dashed border-blue-500/30 bg-blue-500/5 flex flex-col items-center justify-center gap-3 transition-all group"
                              >
                                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all">
                                  <Plus className="w-6 h-6 text-blue-500 group-hover:text-white" />
                                </div>
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Load More</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                  {items.length - (dateLimits[date] || INITIAL_GRID_LIMIT)} remaining
                                </span>
                              </motion.button>
                            )}

                            <motion.button 
                              whileHover={{ scale: 1.05, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => toggleDateExpand(date)}
                              className="aspect-square rounded-3xl border-2 border-dashed border-slate-500/30 bg-slate-500/5 flex flex-col items-center justify-center gap-3 transition-all group"
                            >
                              <div className="w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center group-hover:bg-slate-500 group-hover:text-white transition-all">
                                <ChevronUp className="w-6 h-6 text-slate-400 group-hover:text-white" />
                              </div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Collapse</span>
                            </motion.button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}

function TagsView({ tags, setTags, photos, setPhotos, onTagClick }: { 
  tags: Tag[], 
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>, 
  photos: Photo[], 
  setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>,
  onTagClick: (tagName: string) => void 
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    const newTag: Tag = {
      id: `t-${Date.now()}`,
      name: newTagName.trim(),
      color: newTagColor,
      ownerId: 'demo'
    };
    setTags(prev => [...prev, newTag]);
    setNewTagName('');
    setIsCreating(false);
  };

  const handleDeleteTag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tagToDelete = tags.find(t => t.id === id);
    if (!tagToDelete) return;

    if (confirm(`Are you sure you want to delete "${tagToDelete.name}"? This will remove it from all photos.`)) {
      setTags(prev => prev.filter(t => t.id !== id));
      setPhotos(prev => prev.map(p => ({
        ...p,
        tags: p.tags?.filter(t => t !== tagToDelete.name) || []
      })));
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-black tracking-tighter">Tags Library</h2>
        <div className="flex items-center gap-6">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {tags.length} active tags
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-blue-500 text-white px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            New Tag
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
        {tags.map((tag, index) => (
          <TagCard 
            key={tag.id} 
            tag={tag} 
            photos={photos} 
            index={index} 
            onClick={() => onTagClick(tag.name)} 
            onDelete={(e) => handleDeleteTag(tag.id, e)}
          />
        ))}

        {/* Add New Tag Placeholder */}
        <motion.div
          whileHover={{ y: -10 }}
          className="group cursor-pointer"
          onClick={() => setIsCreating(true)}
        >
          <div className="h-64 mb-6 rounded-3xl border-4 border-dashed border-slate-500/10 flex flex-col items-center justify-center space-y-4 group-hover:border-blue-500/30 group-hover:bg-blue-500/5 transition-all">
            <div className="w-16 h-16 rounded-full bg-slate-500/5 flex items-center justify-center group-hover:bg-blue-500/10 transition-all">
              <Plus className="w-8 h-8 text-slate-400 group-hover:text-blue-500 transition-all" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-all">Create New Tag</span>
          </div>
        </motion.div>
      </div>

      {/* Create Tag Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                    <Tags className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">New Tag</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Create a custom label</p>
                  </div>
                </div>
                <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tag Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold"
                    placeholder="e.g. Summer 2024"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tag Color</label>
                  <div className="flex flex-wrap gap-3">
                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b', '#1e293b'].map(color => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className={cn(
                          "w-10 h-10 rounded-full border-4 transition-all",
                          newTagColor === color ? "border-blue-500 scale-110" : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <input 
                      type="color" 
                      value={newTagColor}
                      onChange={e => setNewTagColor(e.target.value)}
                      className="w-10 h-10 rounded-full overflow-hidden border-none cursor-pointer"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <Check className="w-5 h-5" />
                  Create Tag
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TagCard({ tag, photos, index, onClick, onDelete }: { tag: Tag, photos: Photo[], index: number, onClick: () => void, onDelete: (e: React.MouseEvent) => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const tagPhotos = photos.filter(p => p.tags?.includes(tag.name));
  const previewPhotos = tagPhotos.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -10 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className="group cursor-pointer relative"
    >
      <button 
        onClick={onDelete}
        className="absolute top-4 right-4 z-20 p-2 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-lg"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="relative h-64 mb-6">
        {/* Stacked Photos Effect */}
        {previewPhotos.length > 0 ? (
          previewPhotos.map((photo, i) => (
            <motion.div
              key={photo.id}
              className="absolute inset-0 rounded-3xl overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl"
              animate={{ 
                zIndex: 3 - i,
                rotate: i === 0 ? 0 : i === 1 ? (isHovered ? 12 : 6) : (isHovered ? -12 : -6),
                x: i === 0 ? 0 : i === 1 ? (isHovered ? 30 : 15) : (isHovered ? -30 : -15),
                y: i === 0 ? 0 : i === 1 ? (isHovered ? 20 : 10) : (isHovered ? 10 : 5),
                scale: 1 - (i * 0.05)
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <img src={photo.thumbnailUrl} className="w-full h-full object-cover" alt="" />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
            </motion.div>
          ))
        ) : (
          <div className="absolute inset-0 rounded-3xl bg-slate-500/5 border-4 border-dashed border-slate-500/20 flex items-center justify-center">
            <Tags className="w-12 h-12 text-slate-500/20" />
          </div>
        )}
        
        {/* Tag Badge */}
        <div 
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full shadow-lg text-white font-black text-xs uppercase tracking-widest z-10"
          style={{ backgroundColor: tag.color || '#3b82f6' }}
        >
          {tag.name}
        </div>
      </div>

      <div className="text-center space-y-1">
        <h3 className="font-black text-xl tracking-tight group-hover:text-blue-500 transition-colors">{tag.name}</h3>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          {tagPhotos.length} photos in collection
        </p>
      </div>
    </motion.div>
  );
}

function RecipeView({ recipes, photos, user, theme, onAddRecipe }: { recipes: Recipe[], photos: Photo[], user: User, theme: string, onAddRecipe: (r: Recipe) => void }) {
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [newRecipe, setNewRecipe] = useState<Partial<Recipe>>({
    name: '',
    filmMode: 'Classic Chrome',
    whiteBalance: 'Auto',
    dynamicRange: 'DR100',
    sharpness: '0',
    color: '0',
    highlightTone: '0',
    shadowTone: '0',
    colorChromeEffect: 'Off',
    colorChromeEffectBlue: 'Off',
    isFavorite: false,
    ownerId: user.uid
  });

  const handleCreate = async () => {
    if (!newRecipe.name) return;
    const recipe: Recipe = {
      ...newRecipe as Recipe,
      id: `r-${Date.now()}`
    };
    onAddRecipe(recipe);
    setIsCreating(false);
    setNewRecipe({ 
      name: '', 
      filmMode: 'Classic Chrome', 
      whiteBalance: 'Auto',
      dynamicRange: 'DR100',
      sharpness: '0',
      color: '0',
      highlightTone: '0',
      shadowTone: '0',
      colorChromeEffect: 'Off',
      colorChromeEffectBlue: 'Off',
      isFavorite: false, 
      ownerId: user.uid 
    });
  };

  const filteredRecipes = recipes.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.filmMode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);
  const recipePhotos = photos.filter(p => p.recipeId === selectedRecipeId);

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Film Recipes</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Manage your custom film simulations</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search recipes..."
              className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl pl-12 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-blue-500 text-white px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Recipe List */}
        <div className={cn("space-y-6", selectedRecipeId ? "lg:col-span-4" : "lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 space-y-0")}>
          {filteredRecipes.map(recipe => (
            <motion.div 
              layout
              key={recipe.id} 
              onClick={() => setSelectedRecipeId(recipe.id === selectedRecipeId ? null : recipe.id)}
              className={cn(
                "glass-card rounded-3xl p-8 space-y-6 group cursor-pointer transition-all border-2",
                selectedRecipeId === recipe.id ? "border-blue-500 ring-4 ring-blue-500/10" : "border-transparent hover:border-blue-500/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-black text-xl tracking-tight">{recipe.name}</h3>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{recipe.filmMode}</p>
                </div>
                <Heart className={cn("w-6 h-6 transition-all", recipe.isFavorite ? "text-red-500 fill-red-500" : "text-slate-300 group-hover:text-red-500/50")} />
              </div>
              
              {!selectedRecipeId && (
                <div className="grid grid-cols-2 gap-3">
                  <FilmTag label="WB" value={recipe.whiteBalance} />
                  <FilmTag label="DR" value={recipe.dynamicRange} />
                  <FilmTag label="Sharp" value={recipe.sharpness} />
                  <FilmTag label="Color" value={recipe.color} />
                </div>
              )}

              <div className="pt-6 border-t border-[var(--border-color)] flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {photos.filter(p => p.recipeId === recipe.id).length} photos
                </span>
                <div className="flex items-center gap-2 text-blue-500">
                  <span className="text-[10px] font-black uppercase tracking-widest">Details</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Recipe Details Panel */}
        {selectedRecipeId && selectedRecipe && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-8 space-y-10"
          >
            <div className="glass-card rounded-[2.5rem] p-10 space-y-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                    <Film className="w-8 h-8 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight">{selectedRecipe.name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {selectedRecipe.filmMode}
                      </span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Created by you</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button className="p-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl transition-all border border-[var(--border-color)]">
                    <Edit3 className="w-5 h-5 text-slate-400" />
                  </button>
                  <button className="p-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl transition-all border border-[var(--border-color)]">
                    <Share2 className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'White Balance', value: selectedRecipe.whiteBalance, icon: <Sun className="w-4 h-4" /> },
                  { label: 'Dynamic Range', value: selectedRecipe.dynamicRange, icon: <Zap className="w-4 h-4" /> },
                  { label: 'Sharpness', value: selectedRecipe.sharpness, icon: <Target className="w-4 h-4" /> },
                  { label: 'Color', value: selectedRecipe.color, icon: <Palette className="w-4 h-4" /> },
                  { label: 'Highlight', value: selectedRecipe.highlightTone, icon: <Sun className="w-4 h-4" /> },
                  { label: 'Shadow', value: selectedRecipe.shadowTone, icon: <Moon className="w-4 h-4" /> },
                  { label: 'Chrome FX', value: selectedRecipe.colorChromeEffect, icon: <Layers className="w-4 h-4" /> },
                  { label: 'FX Blue', value: selectedRecipe.colorChromeEffectBlue, icon: <Droplets className="w-4 h-4" /> },
                ].map(stat => (
                  <div key={stat.label} className="p-6 bg-slate-500/5 rounded-3xl border border-[var(--border-color)] space-y-3">
                    <div className="flex items-center gap-2 text-slate-400">
                      {stat.icon}
                      <span className="text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                    </div>
                    <p className="text-xl font-black">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Photos using this recipe</h3>
                  <button className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline">View All</button>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                  {recipePhotos.slice(0, 5).map(photo => (
                    <div key={photo.id} className="aspect-square rounded-2xl overflow-hidden bg-slate-500/10 group relative">
                      <img src={photo.thumbnailUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  ))}
                  {recipePhotos.length === 0 && (
                    <div className="col-span-full py-10 text-center border-2 border-dashed border-slate-500/10 rounded-3xl">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No photos yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="glass w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight">New Recipe</h2>
                <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipe Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold"
                    placeholder="e.g. Kodachrome 64"
                    value={newRecipe.name}
                    onChange={e => setNewRecipe({ ...newRecipe, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Film Mode</label>
                    <CustomSelect 
                      value={newRecipe.filmMode}
                      onChange={(val) => setNewRecipe({ ...newRecipe, filmMode: val })}
                      options={FILM_MODES.map(m => ({ label: m, value: m }))}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">White Balance</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
                      placeholder="Auto"
                      value={newRecipe.whiteBalance}
                      onChange={e => setNewRecipe({ ...newRecipe, whiteBalance: e.target.value })}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Highlight</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
                      placeholder="0"
                      value={newRecipe.highlightTone}
                      onChange={e => setNewRecipe({ ...newRecipe, highlightTone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shadow</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
                      placeholder="0"
                      value={newRecipe.shadowTone}
                      onChange={e => setNewRecipe({ ...newRecipe, shadowTone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Color</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
                      placeholder="0"
                      value={newRecipe.color}
                      onChange={e => setNewRecipe({ ...newRecipe, color: e.target.value })}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FX Blue</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
                      placeholder="Off"
                      value={newRecipe.colorChromeEffectBlue}
                      onChange={e => setNewRecipe({ ...newRecipe, colorChromeEffectBlue: e.target.value })}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleCreate}
                  className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
                >
                  Create Recipe
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="glass-card p-8 rounded-3xl space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
        <div className="p-2 bg-slate-500/5 rounded-xl">
          {icon}
        </div>
      </div>
      <div className="text-4xl font-black tracking-tighter">{value}</div>
    </div>
  );
}

function StatsView({ photos, theme }: { photos: Photo[], theme: string }) {
  const filmStats = FILM_MODES.map(mode => ({
    name: mode,
    count: photos.filter(p => p.filmMode === mode).length
  })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

  const cameraStats = Array.from(new Set(photos.map(p => p.cameraModel))).map(model => ({
    name: model || 'Unknown',
    count: photos.filter(p => p.cameraModel === model).length
  })).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <StatCard label="Total Photos" value={photos.length} icon={<Images className="w-6 h-6 text-blue-500" />} />
        <StatCard label="Favorites" value={photos.filter(p => p.isFavorite).length} icon={<Heart className="w-6 h-6 text-red-500" />} />
        <StatCard label="Cameras" value={cameraStats.length} icon={<Camera className="w-6 h-6 text-green-500" />} />
        <StatCard label="Film Modes" value={filmStats.length} icon={<FlaskConical className="w-6 h-6 text-purple-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="glass-card p-10 rounded-3xl space-y-8">
          <h3 className="font-black text-xl tracking-tight">Film Mode Usage</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filmStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "#333" : "#e2e8f0"} horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: theme === 'dark' ? '#111' : '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-10 rounded-3xl space-y-8">
          <h3 className="font-black text-xl tracking-tight">Camera Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cameraStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="count"
                >
                  {cameraStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: theme === 'dark' ? '#111' : '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-6 justify-center">
            {cameraStats.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{s.name} ({s.count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ 
  theme, 
  setTheme, 
  folders, 
  setFolders,
  cloudSyncEnabled,
  setCloudSyncEnabled,
  onFoldersChanged
}: { 
  theme: string, 
  setTheme: (t: 'light' | 'dark') => void, 
  folders: Folder[], 
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>,
  cloudSyncEnabled: boolean,
  setCloudSyncEnabled: (v: boolean) => void,
  onFoldersChanged: React.Dispatch<React.SetStateAction<Folder[]>>
}) {
  const toggleSubfolders = async (id: string) => {
    const target = folders.find((f) => f.id === id);
    if (!target) return;
    const next = !target.includeSubfolders;
    if (window.electronAPI?.updateFolder) {
      await window.electronAPI.updateFolder({ id, includeSubfolders: next });
    }
    onFoldersChanged(prev => prev.map(f => f.id === id ? { ...f, includeSubfolders: next } : f));
  };

  const removeFolder = async (id: string) => {
    if (confirm('Are you sure you want to remove this folder?')) {
      if (window.electronAPI?.deleteFolder) {
        await window.electronAPI.deleteFolder(id);
      }
      onFoldersChanged(prev => prev.filter(f => f.id !== id));
    }
  };

  const clearCache = async () => {
    if (!window.electronAPI?.clearThumbnailCache) return;
    const result = await window.electronAPI.clearThumbnailCache();
    if (!result?.success) {
      console.error('clear cache failed:', result?.error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-black tracking-tighter">Settings</h2>
      </div>

      {/* Appearance */}
      <section className="space-y-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Appearance</h3>
        <div className="glass-card p-8 rounded-3xl flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-black">Theme Mode</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Switch between light and dark mode</p>
          </div>
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-3 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl transition-all border border-[var(--border-color)]"
          >
            {theme === 'dark' ? <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" /> : <Clock className="w-6 h-6 text-blue-500" />}
          </button>
        </div>
      </section>

      {/* Cache Management */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cache Management</h3>
          <div className="flex items-center gap-4">
            <button onClick={() => { void clearCache(); }} className="text-xs font-black text-blue-500 hover:text-blue-600 uppercase tracking-widest flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Clear All Cache
            </button>
            <button onClick={() => {
              if (confirm('Are you sure you want to clear all photos? This action cannot be undone.')) {
                if (window.electronAPI?.clearAllPhotos) {
                  window.electronAPI.clearAllPhotos();
                }
              }
            }} className="text-xs font-black text-red-500 hover:text-red-600 uppercase tracking-widest flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Clear All Photos
            </button>
          </div>
        </div>
        <div className="glass-card p-8 rounded-3xl space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <p className="font-black text-lg">Cache Directory</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Set the folder where thumbnails and metadata are cached</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="px-4 py-3 bg-slate-500/5 rounded-xl border border-[var(--border-color)] font-mono text-[10px] text-slate-400">
                /Users/fuji/Library/Caches/FujiStore
              </div>
              <button className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20">
                Change...
              </button>
            </div>
          </div>
          
          <div className="pt-8 border-t border-[var(--border-color)] grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cache Size</p>
              <p className="text-2xl font-black tracking-tight">1.24 GB</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cached Items</p>
              <p className="text-2xl font-black tracking-tight">4,821</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Cleaned</p>
              <p className="text-2xl font-black tracking-tight">2 days ago</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cloud Sync */}
      <section className="space-y-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cloud Sync</h3>
        <div className="glass-card p-8 rounded-3xl space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-black text-lg">Enable Cloud Sync</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Automatically backup and sync your photos across devices</p>
            </div>
            <div 
              onClick={() => setCloudSyncEnabled(!cloudSyncEnabled)}
              className={cn(
                "w-14 h-8 rounded-full transition-all relative cursor-pointer",
                cloudSyncEnabled ? "bg-blue-500" : "bg-slate-500/20"
              )}
            >
              <div className={cn(
                "absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm",
                cloudSyncEnabled ? "left-7" : "left-1"
              )} />
            </div>
          </div>

          {cloudSyncEnabled && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-8 border-t border-[var(--border-color)] flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-black uppercase tracking-widest">All files up to date</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last sync: Just now</p>
                </div>
              </div>
              <button className="px-6 py-3 bg-slate-500/5 hover:bg-slate-500/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-[var(--border-color)]">
                Sync Now
              </button>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}

function DesignPosters({ photos, recipes, tags, theme }: { photos: Photo[], recipes: Recipe[], tags: Tag[], theme: string }) {
  const exportPoster = async (id: string, fileName: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    try {
      const dataUrl = await toJpeg(element, { quality: 0.95, backgroundColor: theme === 'dark' ? '#0a0a0a' : '#f8fafc' });
      const link = document.createElement('a');
      link.download = `${fileName}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const totalPhotos = photos.length;
  const favoritePhotos = photos.filter(p => p.isFavorite).length;
  const uniqueCameras = new Set(photos.map(p => p.cameraModel)).size;
  const filmModes = Array.from(new Set(photos.map(p => p.filmMode))).filter(Boolean);
  
  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-32">
      <div className="flex flex-col gap-4">
        <h2 className="text-5xl font-black tracking-tighter">Design Showcase</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Generate and export project design posters</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Poster 1: Overview */}
        <PosterCard 
          id="poster-overview" 
          title="Project Overview" 
          onExport={() => exportPoster('poster-overview', 'fuji-project-overview')}
        >
          <div className="space-y-12">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20">
                <Images className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-3xl font-black tracking-tight">Fuji Store</h3>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Digital Asset Management</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8">
              <BigStat label="Total Assets" value={totalPhotos} />
              <BigStat label="Curated" value={favoritePhotos} />
              <BigStat label="Hardware" value={uniqueCameras} unit="Cameras" />
              <BigStat label="Simulations" value={filmModes.length} />
            </div>

            <div className="pt-8 border-t border-slate-500/10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Core Design Principles</p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm font-bold"><Sparkles className="w-4 h-4 text-blue-500" /> AI-Powered Recipe Recognition</li>
                <li className="flex items-center gap-3 text-sm font-bold"><Layout className="w-4 h-4 text-blue-500" /> Professional Grid & List Views</li>
                <li className="flex items-center gap-3 text-sm font-bold"><FolderIcon className="w-4 h-4 text-blue-500" /> Hierarchical Directory Management</li>
              </ul>
            </div>
          </div>
        </PosterCard>

        {/* Poster 2: Film Simulations */}
        <PosterCard 
          id="poster-films" 
          title="Film Simulations" 
          onExport={() => exportPoster('poster-films', 'fuji-film-simulations')}
        >
          <div className="space-y-10">
            <h3 className="text-2xl font-black tracking-tight">Color Science</h3>
            <div className="space-y-4">
              {filmModes.slice(0, 6).map(mode => {
                const count = photos.filter(p => p.filmMode === mode).length;
                const percentage = (count / totalPhotos) * 100;
                return (
                  <div key={mode} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span>{mode}</span>
                      <span>{count} Photos</span>
                    </div>
                    <div className="h-2 bg-slate-500/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        className="h-full bg-blue-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-6 bg-blue-500/5 rounded-3xl border border-blue-500/10">
              <p className="text-xs font-bold leading-relaxed italic text-slate-500">
                "The soul of Fujifilm photography lies in its film simulations. This project preserves the metadata and visual integrity of every shot."
              </p>
            </div>
          </div>
        </PosterCard>

        {/* Poster 3: AI Recipes */}
        <PosterCard 
          id="poster-recipes" 
          title="AI Recipe Engine" 
          onExport={() => exportPoster('poster-recipes', 'fuji-ai-recipes')}
        >
          <div className="space-y-12">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-purple-500/10 rounded-3xl flex items-center justify-center border border-purple-500/20">
                <FlaskConical className="w-10 h-10 text-purple-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight">Recipe Recognition</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Powered by Gemini 3 Flash</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {recipes.slice(0, 3).map(recipe => (
                <div key={recipe.id} className="p-4 bg-slate-500/5 rounded-2xl border border-slate-500/10 space-y-3">
                  <p className="text-[10px] font-black truncate">{recipe.name}</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[8px] font-black px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded uppercase">{recipe.filmMode}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical Parameters Tracked</p>
              <div className="flex flex-wrap gap-2">
                {['WB Shift', 'Dynamic Range', 'Highlight Tone', 'Shadow Tone', 'Color', 'Sharpness', 'Clarity', 'Grain Effect'].map(p => (
                  <span key={p} className="px-3 py-1 bg-slate-500/5 rounded-full text-[9px] font-bold text-slate-500 border border-slate-500/10">{p}</span>
                ))}
              </div>
            </div>
          </div>
        </PosterCard>

        {/* Poster 4: Organization */}
        <PosterCard 
          id="poster-org" 
          title="Workflow & Structure" 
          onExport={() => exportPoster('poster-org', 'fuji-workflow')}
        >
          <div className="space-y-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-2xl font-black tracking-tight">Data Architecture</h3>
            </div>

            <div className="space-y-8">
              <div className="flex items-start gap-6">
                <div className="w-1 bg-blue-500 h-24 rounded-full" />
                <div className="space-y-6">
                  <OrgItem icon={<FolderIcon className="w-4 h-4" />} title="Directory Tree" desc="Recursive folder management with real-time photo counts." />
                  <OrgItem icon={<Clock className="w-4 h-4" />} title="Timeline View" desc="Chronological grouping with smooth layout transitions." />
                  <OrgItem icon={<Tags className="w-4 h-4" />} title="Tag Library" desc="Multi-dimensional filtering and automated categorization." />
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-500/10 flex justify-between items-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Build v1.0.4</div>
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-[var(--bg-primary)] bg-slate-200 overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="avatar" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PosterCard>
      </div>
    </div>
  );
}

function PosterCard({ id, title, children, onExport }: { id: string, title: string, children: React.ReactNode, onExport: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{title}</h4>
        <button 
          onClick={onExport}
          className="p-2 hover:bg-blue-500/10 rounded-xl transition-all text-blue-500 group"
          title="Export as JPG"
        >
          <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>
      </div>
      <div 
        id={id}
        className="aspect-[3/4] glass-card rounded-[3rem] p-12 relative overflow-hidden shadow-2xl border border-[var(--border-color)]"
      >
        {/* Background Accents */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
        
        <div className="relative h-full flex flex-col justify-between">
          {children}
          
          <div className="mt-auto pt-12 flex items-center justify-between opacity-30">
            <span className="text-[8px] font-black uppercase tracking-[0.3em]">Fuji Store Design System</span>
            <span className="text-[8px] font-black uppercase tracking-[0.3em]">2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, unit }: { label: string, value: number, unit?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black tracking-tighter">{value}</span>
        {unit && <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>}
      </div>
    </div>
  );
}

function OrgItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <div className="text-blue-500">{icon}</div>
        <p className="font-black text-sm">{title}</p>
      </div>
      <p className="text-xs text-slate-400 font-medium leading-relaxed">{desc}</p>
    </div>
  );
}

// --- Export Templates View ---
function ExportTemplates({ theme, onTryTemplate }: { theme: string, onTryTemplate: (templateId: string) => void }) {
  const templates = [
    { id: 'minimal', name: 'Minimalist', description: 'Clean, white background with centered photo and recipe below.', preview: 'https://picsum.photos/seed/minimal/400/600' },
    { id: 'magazine', name: 'Magazine', description: 'Elegant serif fonts with overlapping elements and artistic layout.', preview: 'https://picsum.photos/seed/magazine/400/600' },
    { id: 'insta', name: 'Insta-Square', description: '1:1 ratio with polaroid-style border and recipe at the bottom.', preview: 'https://picsum.photos/seed/insta/400/400' },
    { id: 'darktech', name: 'Dark Cinematic', description: 'Dark background with neon accents and technical EXIF display.', preview: 'https://picsum.photos/seed/dark/400/600' },
    { id: 'custom', name: 'Custom Design', description: 'Design your own layout, colors, and EXIF fields.', preview: 'https://picsum.photos/seed/custom/400/600' }
  ];

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tighter">Export Templates</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Choose a style for your recipe sharing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {templates.map(template => (
          <motion.div 
            key={template.id}
            whileHover={{ y: -8 }}
            className="glass-card rounded-[2rem] overflow-hidden flex flex-col group"
          >
            <div className="aspect-[3/4] relative overflow-hidden bg-slate-500/5">
              <img src={template.preview} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500" alt={template.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                <p className="text-white text-xs font-bold leading-relaxed">{template.description}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black">{template.name}</h3>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Palette className="w-4 h-4 text-blue-500" />
                </div>
              </div>
              <button 
                onClick={() => onTryTemplate(template.id)}
                className="w-full py-3 bg-slate-500/5 hover:bg-slate-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-[var(--border-color)]"
              >
                Try Style
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

interface CustomSettings {
  backgroundColor: string;
  textColor: string;
  fontFamily: 'sans' | 'serif' | 'mono' | 'display';
  borderRadius: number;
  padding: number;
  showExif: {
    wb: boolean;
    dr: boolean;
    iso: boolean;
    shutter: boolean;
    aperture: boolean;
    lens: boolean;
    camera: boolean;
  };
  layout: 'stacked' | 'split';
}

// --- Recipe Export Modal ---
function RecipeExportModal({ photo, onClose, theme, initialTemplate = 'minimal' }: { photo: Photo, onClose: () => void, theme: string, initialTemplate?: string }) {
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplate);
  const [exporting, setExporting] = useState(false);
  const [customSettings, setCustomSettings] = useState<CustomSettings>({
    backgroundColor: theme === 'dark' ? '#0a0a0a' : '#ffffff',
    textColor: theme === 'dark' ? '#f8fafc' : '#0f172a',
    fontFamily: 'sans',
    borderRadius: 16,
    padding: 32,
    showExif: {
      wb: true,
      dr: true,
      iso: true,
      shutter: true,
      aperture: true,
      lens: true,
      camera: true
    },
    layout: 'stacked'
  });
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toJpeg(exportRef.current, { quality: 0.95, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `FujiRecipe_${photo.fileName.split('.')[0]}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass w-full max-w-5xl h-[90vh] rounded-[3rem] overflow-hidden flex flex-col lg:flex-row shadow-2xl"
      >
        {/* Preview Area */}
        <div className="flex-1 bg-slate-900/50 flex items-center justify-center p-8 overflow-auto">
          <div ref={exportRef} className="shadow-2xl">
            {selectedTemplate === 'minimal' && <MinimalTemplate photo={photo} />}
            {selectedTemplate === 'magazine' && <MagazineTemplate photo={photo} />}
            {selectedTemplate === 'insta' && <InstaTemplate photo={photo} />}
            {selectedTemplate === 'darktech' && <DarkTechTemplate photo={photo} />}
            {selectedTemplate === 'custom' && <CustomTemplate photo={photo} settings={customSettings} />}
          </div>
        </div>

        {/* Controls Area */}
        <div className="w-full lg:w-96 bg-[var(--bg-primary)] border-l border-[var(--border-color)] flex flex-col">
          <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Export Recipe</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Select a template to share</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-500/10 rounded-xl transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Choose Template</label>
              <div className="grid grid-cols-2 gap-4">
                {['minimal', 'magazine', 'insta', 'darktech', 'custom'].map(t => (
                  <button 
                    key={t}
                    onClick={() => setSelectedTemplate(t)}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all text-left space-y-2",
                      selectedTemplate === t 
                        ? "border-blue-500 bg-blue-500/5" 
                        : "border-transparent bg-slate-500/5 hover:bg-slate-500/10"
                    )}
                  >
                    <p className="text-xs font-black uppercase tracking-widest">{t}</p>
                    <div className="w-full aspect-video bg-slate-500/10 rounded-lg flex items-center justify-center">
                      {t === 'custom' && <Settings className="w-4 h-4 opacity-40" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedTemplate === 'custom' && (
              <div className="space-y-8 pt-4 border-t border-[var(--border-color)]">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Colors</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500">Background</p>
                      <input 
                        type="color" 
                        value={customSettings.backgroundColor}
                        onChange={(e) => setCustomSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                        className="w-full h-10 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500">Text</p>
                      <input 
                        type="color" 
                        value={customSettings.textColor}
                        onChange={(e) => setCustomSettings(prev => ({ ...prev, textColor: e.target.value }))}
                        className="w-full h-10 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Typography</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['sans', 'serif', 'mono', 'display'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setCustomSettings(prev => ({ ...prev, fontFamily: f }))}
                        className={cn(
                          "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                          customSettings.fontFamily === f ? "bg-blue-500 text-white border-blue-500" : "bg-slate-500/5 border-transparent"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Layout</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['stacked', 'split'] as const).map(l => (
                      <button
                        key={l}
                        onClick={() => setCustomSettings(prev => ({ ...prev, layout: l }))}
                        className={cn(
                          "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                          customSettings.layout === l ? "bg-blue-500 text-white border-blue-500" : "bg-slate-500/5 border-transparent"
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EXIF Fields</label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {Object.entries(customSettings.showExif).map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => setCustomSettings(prev => ({
                          ...prev,
                          showExif: { ...prev.showExif, [key]: !value }
                        }))}
                        className="flex items-center gap-2 group"
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          value ? "bg-blue-500 border-blue-500" : "border-slate-300 group-hover:border-blue-500"
                        )}>
                          {value && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{key}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Radius & Padding</label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500">
                        <span>Radius</span>
                        <span>{customSettings.borderRadius}px</span>
                      </div>
                      <input 
                        type="range" min="0" max="64" value={customSettings.borderRadius}
                        onChange={(e) => setCustomSettings(prev => ({ ...prev, borderRadius: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500">
                        <span>Padding</span>
                        <span>{customSettings.padding}px</span>
                      </div>
                      <input 
                        type="range" min="16" max="128" value={customSettings.padding}
                        onChange={(e) => setCustomSettings(prev => ({ ...prev, padding: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 border-t border-[var(--border-color)]">
            <button 
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {exporting ? 'Generating...' : 'Download JPG'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- Specific Templates ---

function CustomTemplate({ photo, settings }: { photo: Photo, settings: CustomSettings }) {
  const fontClass = {
    sans: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono',
    display: 'font-display'
  }[settings.fontFamily];

  const exifFields = [
    { key: 'camera', label: 'CAMERA', value: photo.cameraModel },
    { key: 'lens', label: 'LENS', value: photo.lensModel },
    { key: 'iso', label: 'ISO', value: photo.iso },
    { key: 'shutter', label: 'SHUTTER', value: photo.exposureTime },
    { key: 'aperture', label: 'APERTURE', value: photo.fNumber },
    { key: 'wb', label: 'WB', value: photo.whiteBalance },
    { key: 'dr', label: 'DR', value: photo.dynamicRange },
  ].filter(f => settings.showExif[f.key as keyof typeof settings.showExif]);

  return (
    <div 
      className={cn(
        "w-[400px] flex flex-col",
        settings.layout === 'split' ? "flex-row h-[500px]" : "min-h-[500px]",
        fontClass
      )}
      style={{ 
        backgroundColor: settings.backgroundColor, 
        color: settings.textColor,
        padding: `${settings.padding}px`
      }}
    >
      <div className={cn(
        "overflow-hidden shadow-lg mb-6",
        settings.layout === 'split' ? "w-1/2 mb-0 mr-6 h-full" : "w-full aspect-[4/5]"
      )}
      style={{ borderRadius: `${settings.borderRadius}px` }}
      >
        <img src={photo.thumbnailUrl} className="w-full h-full object-cover" alt="" />
      </div>

      <div className={cn(
        "flex flex-col justify-center",
        settings.layout === 'split' ? "w-1/2" : "w-full"
      )}>
        <div className="mb-6">
          <h3 className="text-2xl font-black tracking-tight leading-tight">{photo.filmMode}</h3>
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mt-1">Fujifilm Recipe</p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {exifFields.map(field => (
            <div key={field.key} className="space-y-0.5">
              <p className="text-[8px] font-black uppercase tracking-widest opacity-40">{field.label}</p>
              <p className="text-[11px] font-bold truncate">{field.value || 'N/A'}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-current opacity-10 flex items-center justify-between">
          <span className="text-[8px] font-black tracking-[0.3em]">FUJI STATION</span>
          <span className="text-[8px] font-black tracking-[0.3em]">CUSTOM_GEN</span>
        </div>
      </div>
    </div>
  );
}

function MinimalTemplate({ photo }: { photo: Photo }) {
  return (
    <div className="w-[400px] bg-white p-10 flex flex-col items-center space-y-8 text-slate-900 font-sans">
      <div className="w-full aspect-[4/5] overflow-hidden rounded-sm shadow-lg">
        <img src={photo.thumbnailUrl} className="w-full h-full object-cover" alt="" />
      </div>
      <div className="w-full space-y-6 text-center">
        <div className="space-y-1">
          <h3 className="text-2xl font-serif italic">{photo.filmMode}</h3>
          <p className="text-[10px] uppercase tracking-[0.3em] font-light text-slate-400">Fujifilm Recipe</p>
        </div>
        <div className="grid grid-cols-3 gap-y-4 text-[9px] uppercase tracking-widest font-bold border-t border-slate-100 pt-6">
          <div className="space-y-1">
            <p className="text-slate-300">WB</p>
            <p>{photo.whiteBalance}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-300">DR</p>
            <p>{photo.dynamicRange}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-300">ISO</p>
            <p>{photo.iso}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-300">NR</p>
            <p>{photo.noiseReduction}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-300">SHARP</p>
            <p>{photo.sharpness}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-300">CLARITY</p>
            <p>{photo.clarity}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MagazineTemplate({ photo }: { photo: Photo }) {
  return (
    <div className="w-[450px] bg-[#fdfcf8] p-12 flex flex-col space-y-10 text-slate-900 font-serif relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16" />
      <div className="z-10 space-y-2">
        <h3 className="text-5xl font-black tracking-tighter leading-none">{photo.filmMode?.split('/')[0]}</h3>
        <p className="text-sm font-sans font-black uppercase tracking-[0.4em] text-blue-600">The Fuji Journal</p>
      </div>
      <div className="w-full aspect-[3/4] overflow-hidden shadow-2xl relative">
        <img src={photo.thumbnailUrl} className="w-full h-full object-cover" alt="" />
        <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md px-4 py-2 text-[10px] font-sans font-black uppercase tracking-widest">
          {photo.cameraModel}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 font-sans">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">Settings</p>
          <div className="space-y-2 text-[11px] font-bold">
            <div className="flex justify-between"><span>WB</span><span>{photo.whiteBalance}</span></div>
            <div className="flex justify-between"><span>DR</span><span>{photo.dynamicRange}</span></div>
            <div className="flex justify-between"><span>Grain</span><span>{photo.grainEffect}</span></div>
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">Tones</p>
          <div className="space-y-2 text-[11px] font-bold">
            <div className="flex justify-between"><span>Shadow</span><span>{photo.shadowTone}</span></div>
            <div className="flex justify-between"><span>Highlight</span><span>{photo.highlightTone}</span></div>
            <div className="flex justify-between"><span>Color</span><span>{photo.saturation}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstaTemplate({ photo }: { photo: Photo }) {
  return (
    <div className="w-[400px] aspect-square bg-slate-50 p-6 flex flex-col font-sans">
      <div className="flex-1 bg-white p-4 shadow-lg flex flex-col space-y-4">
        <div className="flex-1 overflow-hidden">
          <img src={photo.thumbnailUrl} className="w-full h-full object-cover" alt="" />
        </div>
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="space-y-0.5">
            <h3 className="text-lg font-black tracking-tight">{photo.filmMode}</h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{photo.cameraModel} • {photo.lensModel}</p>
          </div>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DarkTechTemplate({ photo }: { photo: Photo }) {
  return (
    <div className="w-[400px] bg-slate-950 p-10 flex flex-col space-y-8 text-white font-mono">
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="space-y-1">
          <p className="text-[8px] text-blue-500 font-bold uppercase tracking-widest">System.Recipe</p>
          <h3 className="text-xl font-black tracking-tighter">{photo.filmMode?.toUpperCase()}</h3>
        </div>
        <div className="text-right">
          <p className="text-[8px] text-slate-500 uppercase tracking-widest">Status</p>
          <p className="text-[10px] text-green-500 font-bold">VERIFIED</p>
        </div>
      </div>
      <div className="w-full aspect-video overflow-hidden border border-white/10 relative">
        <img src={photo.thumbnailUrl} className="w-full h-full object-cover grayscale opacity-80" alt="" />
        <div className="absolute inset-0 border-[20px] border-transparent border-t-white/5 border-l-white/5" />
      </div>
      <div className="grid grid-cols-2 gap-6 text-[10px]">
        <div className="space-y-3">
          <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">WB_SHIFT</span><span>{photo.whiteBalanceShift || '0,0'}</span></div>
          <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">ISO_SENS</span><span>{photo.iso}</span></div>
          <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">EXP_TIME</span><span>{photo.exposureTime}</span></div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">CHROME_FX</span><span>{photo.colorChromeEffect}</span></div>
          <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">GRAIN_FX</span><span>{photo.grainEffect}</span></div>
          <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">SHARP_LVL</span><span>{photo.sharpness}</span></div>
        </div>
      </div>
      <div className="pt-4 flex items-center gap-4 opacity-30">
        <div className="flex-1 h-[1px] bg-white" />
        <p className="text-[8px] tracking-[0.5em]">FUJIFILM_X_SERIES</p>
        <div className="flex-1 h-[1px] bg-white" />
      </div>
    </div>
  );
}

