import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Images, 
  Clock, 
  Heart, 
  Tags, 
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
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  Palette,
  Share2,
  Download,
  ExternalLink,
  RefreshCw,
  ListTodo
} from 'lucide-react';

import { cn } from './lib/utils';
import { Photo, Recipe, Tag, Folder } from './types';
import { FILM_MODES, FILM_SHORT_CODES, COLORS } from './constants/filmModes';
import { isPhotoInFolder } from './utils/fileUtils';
import { useLanguage } from './hooks/useLanguage';

// Custom Hooks
import { usePhotoLibrary } from './hooks/usePhotoLibrary';
import { useTimeline } from './hooks/useTimeline';

// Services
import { photoService } from './services/photoService';
import { folderService } from './services/folderService';
import { tagService } from './services/tagService';

// Common Components
import { NavItem } from './components/common/NavItem';
import { PhotoCard } from './components/common/PhotoCard';
import { DirectoryTree } from './components/common/DirectoryTree';
import { ThumbImage } from './components/common/ThumbImage';
import { CustomSelect } from './components/common/CustomSelect';
import { CustomDatePicker } from './components/common/CustomDatePicker';

// Modals
import { ConfirmModal } from './components/modals/ConfirmModal';
import { PhotoDetailModal } from './components/modals/PhotoDetailModal';
import { ImportModal, ImportQueuePayload } from './components/modals/ImportModal';
import { SyncFolderModal } from './components/modals/SyncFolderModal';
import { FolderInfoModal } from './components/modals/FolderInfoModal';
import { RecipeExportModal } from './components/modals/RecipeExportModal';

// Views
import { StatsView } from './components/views/StatsView';
import { TagsView } from './components/views/TagsView';
import { SettingsView } from './components/views/SettingsView';
import { MetadataParserView } from './components/views/MetadataParserView';
import { RecipeView } from './components/views/RecipeView';
import { TimelineView } from './components/views/TimelineView';
import { TemplatesView } from './components/views/TemplatesView';
import defaultConfig from './constants/metadata-default-config.json';

// Mock User Type
interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

type ImportTaskStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

interface ImportTask {
  id: string;
  name: string;
  createdAt: number;
  status: ImportTaskStatus;
  progress: number;
  scanned: number;
  success: number;
  failed: number;
  skipped: number;
  error?: string | null;
  payload: ImportQueuePayload;
}

const IMPORT_TASKS_STORAGE_KEY = 'fuji_import_tasks_v1';

const ROOT_PARENT_ID = '-1';

// 从服务层获取真实数据，不再使用模拟数据

export default function App() {
  const { t, locale, language, setLanguage } = useLanguage();
  
  // User state
  const [user, setUser] = useState<User | null>({ 
    uid: 'demo', 
    email: 'feng46042@gmail.com', 
    displayName: 'Fuji User',
    photoURL: './assets/avatar.svg'
  } as any);
  
  // View state
  const [activeView, setActiveView] = useState<'photos' | 'timeline' | 'recipes' | 'stats' | 'settings' | 'favorites' | 'hidden' | 'tags' | 'posters' | 'templates' | 'metadataParser'>('photos');
  const [previousView, setPreviousView] = useState<'photos' | 'timeline' | 'recipes' | 'stats' | 'settings' | 'favorites' | 'hidden' | 'tags' | 'posters' | 'templates'>('settings');
  const [metadataFields, setMetadataFields] = useState<any[]>([]);
  const [displayConfig, setDisplayConfig] = useState<Record<string, string[]>>({
    photoList: [],
    photoDetail: [],
    recipeList: [],
    recipeDetail: [],
  });
  const [configLoaded, setConfigLoaded] = useState(false);
  
  const DEFAULT_DISPLAY_CONFIG = defaultConfig.displayConfig || {
    photoList: ['filmSimulation', 'whiteBalance'],
    photoDetail: ['filmSimulation', 'whiteBalance', 'dynamicRange', 'sharpness', 'saturation', 'contrast', 'highlightTone', 'shadowTone', 'noiseReduction', 'clarity', 'grainEffect', 'colorChromeEffect', 'colorChromeEffectBlue'],
    recipeList: ['filmSimulation', 'whiteBalance', 'dynamicRange'],
    recipeDetail: ['filmSimulation', 'whiteBalance', 'dynamicRange', 'sharpness', 'saturation', 'contrast', 'highlightTone', 'shadowTone', 'noiseReduction', 'clarity', 'grainEffect', 'colorChromeEffect', 'colorChromeEffectBlue', 'whiteBalanceShift'],
  };
  
  // 启动时从数据库加载配置
  useEffect(() => {
    const loadDisplayConfig = async () => {
      if (window.electronAPI?.getDisplayConfig) {
        const dbConfig = await window.electronAPI.getDisplayConfig();
        if (dbConfig) {
          console.log('[App] Loaded display config from database:', dbConfig);
          setDisplayConfig(dbConfig);
          setConfigLoaded(true);
        } else {
          const localConfig = localStorage.getItem('fuji_metadata_display_config');
          if (localConfig) {
            try {
              const parsed = JSON.parse(localConfig);
              setDisplayConfig(parsed);
              await window.electronAPI.saveDisplayConfig(parsed);
              console.log('[App] Synced local config to database');
            } catch (e) {
              console.error('[App] Error parsing local config:', e);
              setDisplayConfig(DEFAULT_DISPLAY_CONFIG);
              await window.electronAPI.saveDisplayConfig(DEFAULT_DISPLAY_CONFIG);
            }
          } else {
            setDisplayConfig(DEFAULT_DISPLAY_CONFIG);
            await window.electronAPI.saveDisplayConfig(DEFAULT_DISPLAY_CONFIG);
            console.log('[App] Saved default config to database');
          }
          setConfigLoaded(true);
        }
      } else {
        const localConfig = localStorage.getItem('fuji_metadata_display_config');
        if (localConfig) {
          try {
            const parsed = JSON.parse(localConfig);
            setDisplayConfig(parsed);
          } catch (e) {
            setDisplayConfig(DEFAULT_DISPLAY_CONFIG);
          }
        } else {
          setDisplayConfig(DEFAULT_DISPLAY_CONFIG);
        }
        setConfigLoaded(true);
      }
    };
    loadDisplayConfig();
  }, []);
  
  // 保存配置到数据库和本地
  const handleDisplayConfigChange = useCallback(async (newConfig: Record<string, string[]>) => {
    setDisplayConfig(newConfig);
    localStorage.setItem('fuji_metadata_display_config', JSON.stringify(newConfig));
    if (window.electronAPI?.saveDisplayConfig) {
      await window.electronAPI.saveDisplayConfig(newConfig);
    }
  }, []);
  
  // Modal states
  const [importModalInitialType, setImportModalInitialType] = useState<'files' | 'folders'>('files');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'import' | 'create'>('import');
  const [folderName, setFolderName] = useState('');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncFolderId, setSyncFolderId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportPhoto, setExportPhoto] = useState<Photo | null>(null);
  const [initialExportTemplate, setInitialExportTemplate] = useState('minimal');
  const [importTasks, setImportTasks] = useState<ImportTask[]>([]);
  const [showImportTasks, setShowImportTasks] = useState(false);
  
  // UI states
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
  
  // Sidebar width state
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  
  // Confirmation modal states
  const [showDirectoryClearConfirm, setShowDirectoryClearConfirm] = useState<boolean>(false);
  const [showDirectoryDeleteConfirm, setShowDirectoryDeleteConfirm] = useState<boolean>(false);
  const [currentDirectoryId, setCurrentDirectoryId] = useState<string>('');
  const [showDeleteTagConfirm, setShowDeleteTagConfirm] = useState<{ show: boolean, tagId: string }>({ show: false, tagId: '' });
  const [showFolderInfo, setShowFolderInfo] = useState<{ name: string; path: string } | null>(null);
  
  // Photo pagination
  const [photoPage, setPhotoPage] = useState(1);
  const [hasMorePhotos, setHasMorePhotos] = useState(true);
  const [loadingMorePhotos, setLoadingMorePhotos] = useState(false);
  const PHOTO_PAGE_SIZE = 120;
  
  // Search states
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  
  // Recipes state - 后续可以从服务层获取
  
  // Use custom hooks
  const { 
    photos, 
    setPhotos, 
    folders, 
    setFolders, 
    tags, 
    setTags, 
    thumbnailDir,
    loading,
    error,
    bootProgress,
    reload
  } = usePhotoLibrary();
  
  const { 
    photos: timelinePhotos, 
    loading: timelineLoading 
  } = useTimeline(activeView === 'timeline');



  // 不再使用模拟数据，依赖usePhotoLibrary钩子从服务层获取数据

  const queueRunningRef = useRef(false);
  const cancelRequestedRef = useRef<Set<string>>(new Set());

  const queueCount = importTasks.filter(t => t.status === 'queued').length;
  const runningCount = importTasks.filter(t => t.status === 'running').length;

  const updateImportTask = useCallback((id: string, patch: Partial<ImportTask>) => {
    setImportTasks(prev => prev.map(task => task.id === id ? { ...task, ...patch } : task));
  }, []);

  const pickScanStats = (obj: any) => {
    const source = obj?.finalProgress || obj || {};
    const scanned = Number(source.scanned || 0);
    const success = Number(source.indexed || source.success || 0);
    const failed = Number(source.failed || 0);
    const skipped = Number(source.skipped || 0);
    return { scanned, success, failed, skipped };
  };

  const handleQueueImport = useCallback((payload: ImportQueuePayload) => {
    const id = `import-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const name = payload.type === 'folders'
      ? (payload.folderName || payload.folderPath || '文件夹导入')
      : `${payload.filePaths?.length || 0} 张照片`;
    setImportTasks(prev => [
      ...prev,
      {
        id,
        name,
        createdAt: Date.now(),
        status: 'queued',
        progress: 0,
        scanned: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        error: null,
        payload,
      },
    ]);
    setShowImportTasks(true);
  }, []);

  const handleCancelImportTask = useCallback(async (task: ImportTask) => {
    cancelRequestedRef.current.add(task.id);
    if (task.status === 'queued') {
      updateImportTask(task.id, {
        status: 'cancelled',
        progress: 100,
        error: '已取消',
      });
      return;
    }
    if (task.status === 'running' && task.payload.type === 'folders' && window.electronAPI?.cancelScan) {
      try {
        await window.electronAPI.cancelScan();
      } catch {
      }
    }
  }, [updateImportTask]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(IMPORT_TASKS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setImportTasks(parsed.map((item: any) => {
          if (item?.status === 'running' || item?.status === 'queued') {
            return {
              ...item,
              status: 'error',
              error: item?.error || '应用重启导致任务中断',
              progress: 100,
            };
          }
          return item;
        }));
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(IMPORT_TASKS_STORAGE_KEY, JSON.stringify(importTasks));
    } catch {
    }
  }, [importTasks]);

  useEffect(() => {
    const runNext = async () => {
      if (queueRunningRef.current) return;
      const next = importTasks.find(task => task.status === 'queued');
      if (!next || !window.electronAPI) return;

      queueRunningRef.current = true;
      updateImportTask(next.id, { status: 'running', progress: 1, error: null });

      try {
        if (cancelRequestedRef.current.has(next.id)) {
          updateImportTask(next.id, { status: 'cancelled', progress: 100, error: '已取消' });
          return;
        }

        if (next.payload.type === 'files') {
          const files = next.payload.filePaths || [];
          const total = files.length;
          let success = 0;
          let failed = 0;

          for (let i = 0; i < total; i += 1) {
            if (cancelRequestedRef.current.has(next.id)) {
              updateImportTask(next.id, {
                status: 'cancelled',
                progress: 100,
                scanned: total,
                success,
                failed,
                skipped: Math.max(0, total - (success + failed)),
                error: '已取消',
              });
              break;
            }
            try {
              await window.electronAPI.importFiles({
                files: [files[i]],
                targetFolderId: next.payload.targetFolderId,
              });
              success += 1;
            } catch {
              failed += 1;
            }
            const progress = total > 0 ? Math.min(99, Math.round(((i + 1) / total) * 100)) : 100;
            updateImportTask(next.id, {
              progress,
              scanned: total,
              success,
              failed,
              skipped: 0,
            });
          }

          if (!cancelRequestedRef.current.has(next.id)) {
            updateImportTask(next.id, {
              status: 'done',
              progress: 100,
              scanned: total,
              success,
              failed,
              skipped: 0,
            });
          }
        } else {
          const folderPath = next.payload.folderPath || '';
          let pollTimer: ReturnType<typeof setInterval> | null = null;

          if (folderPath && window.electronAPI.getScanProgress) {
            pollTimer = setInterval(async () => {
              try {
                const p = await window.electronAPI.getScanProgress(folderPath);
                const { scanned, success, failed, skipped } = pickScanStats(p);
                const processed = success + failed + skipped;
                const progress = scanned > 0 ? Math.min(99, Math.round((processed / scanned) * 100)) : 1;
                updateImportTask(next.id, { scanned, success, failed, skipped, progress });
              } catch {
              }
            }, 400);
          }

          try {
            const result = await window.electronAPI.importFolder({
              folderPath,
              targetFolderId: next.payload.targetFolderId,
              allowedFormats: next.payload.allowedFormats,
            });
            if (cancelRequestedRef.current.has(next.id)) {
              updateImportTask(next.id, {
                status: 'cancelled',
                progress: 100,
                error: '已取消',
              });
            } else {
              const { scanned, success, failed, skipped } = pickScanStats(result);
              updateImportTask(next.id, {
                status: 'done',
                progress: 100,
                scanned,
                success,
                failed,
                skipped,
              });
            }
          } finally {
            if (pollTimer) clearInterval(pollTimer);
          }
        }

        if (!cancelRequestedRef.current.has(next.id) && window.electronAPI.triggerLibraryUpdate) {
          await window.electronAPI.triggerLibraryUpdate();
        }
        if (!cancelRequestedRef.current.has(next.id)) {
          setPhotoPage(1);
          setHasMorePhotos(true);
          await reload();
        }
      } catch (error: any) {
        if (cancelRequestedRef.current.has(next.id)) {
          updateImportTask(next.id, {
            status: 'cancelled',
            progress: 100,
            error: '已取消',
          });
        } else {
          updateImportTask(next.id, {
            status: 'error',
            progress: 100,
            error: error?.message || String(error),
          });
        }
      } finally {
        cancelRequestedRef.current.delete(next.id);
        queueRunningRef.current = false;
      }
    };

    void runNext();
  }, [importTasks, reload, updateImportTask]);

  useEffect(() => {
    const hasRunningOrQueued = importTasks.some(t => t.status === 'running' || t.status === 'queued');
    if (!hasRunningOrQueued && showImportTasks) {
      setShowImportTasks(false);
    }
    setImportTasks(prev => {
      const next = hasRunningOrQueued
        ? prev.filter(t => t.status !== 'done' && t.status !== 'cancelled')
        : prev.filter(t => t.status === 'error');
      return next.length === prev.length ? prev : next;
    });
  }, [importTasks, showImportTasks]);

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('fuji-theme') as 'light' | 'dark';
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem('fuji-theme', theme);
  }, [theme]);

  // Mock sync effect
  useEffect(() => {
    console.log('Mock data sync initialized');
  }, [user]);

  // Load more photos
  const loadMorePhotosFromDb = async () => {
    if (loadingMorePhotos || !hasMorePhotos) return;
    if (!window.electronAPI) return;
    
    try {
      setLoadingMorePhotos(true);
      const nextPage = photoPage + 1;
      const pageData = await photoService.loadPhotosPage(nextPage, PHOTO_PAGE_SIZE, thumbnailDir);
      
      if (pageData.items.length > 0) {
        setPhotos(prev => [...prev, ...pageData.items]);
      }
      
      setPhotoPage(nextPage);
      setHasMorePhotos(nextPage < pageData.totalPages);
    } catch (err) {
      console.error('Failed to load more photos:', err);
      setHasMorePhotos(false);
    } finally {
      setLoadingMorePhotos(false);
    }
  };

  // Filtered photos
  const activeFolder = folders.find((f) => f.id === activeFolderId) || null;
  const filteredPhotos = useMemo(() => {
    if (activeView !== 'photos' && activeView !== 'favorites') {
      return [];
    }
    return photos.filter(p => {
      const matchesSearch = (p.fileName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                           p.cameraModel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.filmMode?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilm = filterFilmMode === 'All' || p.filmMode === filterFilmMode;
      const matchesExtension = filterExtension === 'All' || (p.fileName?.toUpperCase() || '').endsWith(`.${filterExtension}`);
      const matchesDate = !filterDate || p.dateTime?.startsWith(filterDate);
      const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => p.tags?.includes(tag));
      const matchesFolder = !activeFolderId || isPhotoInFolder(p, activeFolder);
      
      const matchesView = activeView === 'photos' ? true :
                         activeView === 'favorites' ? p.isFavorite :
                         true;
      
      return matchesSearch && matchesFilm && matchesExtension && matchesDate && matchesTags && matchesFolder && matchesView;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = (a.fileName || '').localeCompare(b.fileName || '', undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortBy === 'date') {
        const ta = new Date(a.dateTime || '').getTime();
        const tb = new Date(b.dateTime || '').getTime();
        comparison = (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
      } else if (sortBy === 'size') {
        comparison = Number(a.size || 0) - Number(b.size || 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [photos, searchQuery, filterFilmMode, filterExtension, filterDate, selectedTags, activeFolderId, activeFolder, activeView, sortBy, sortOrder]);
  
  // Folder operations
  const handleFolderRename = async (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const newName = window.prompt('Enter new folder name:', folder.name);
    if (newName && newName !== folder.name) {
      await folderService.updateFolder(id, { name: newName });
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    }
  };

  const handleFolderAddSubfolder = async (parentId: string) => {
    const parent = folders.find(f => f.id === parentId);
    const newName = window.prompt(`Enter subfolder name for "${parent?.name}":`, 'New Subfolder');
    if (newName) {
      const created = await folderService.createFolder({
        name: newName,
        parentId,
        path: parent?.type === 'physical' && parent?.path ? `${parent.path}/${newName}` : null,
        type: parent?.type === 'physical' ? 'physical' : 'logical',
      });
      
      if (created) {
        setFolders(prev => [...prev, created]);
      }
    }
  };

  // 键盘导航支持
  useEffect(() => {
    if (!selectedPhoto) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
      if (currentIndex === -1) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            setSelectedPhoto(filteredPhotos[currentIndex - 1]);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < filteredPhotos.length - 1) {
            setSelectedPhoto(filteredPhotos[currentIndex + 1]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedPhoto(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, filteredPhotos, setSelectedPhoto]);

  const handleFolderAddFiles = (id: string) => {
    setActiveFolderId(id);
    setImportModalInitialType('files');
    setIsImportModalOpen(true);
  };

  const handleFolderReorder = async (draggedId: string, targetId: string) => {
    // 处理拖到根目录的情况，使用-1作为根目录的parentId
    const parentId = targetId === ROOT_PARENT_ID ? ROOT_PARENT_ID : targetId;
    const siblingFolders = folders.filter((folder) => (folder.parentId || ROOT_PARENT_ID) === parentId && folder.id !== draggedId);
    const nextSortOrder = siblingFolders.reduce((max, folder) => Math.max(max, Number(folder.sortOrder ?? 0)), 0) + 1;
    
    // 调用服务更新文件夹父级关系和排序号
    await folderService.updateFolderParent(draggedId, parentId, nextSortOrder);
    
    // 更新前端状态，立即显示文件夹的新位置
    setFolders(prev => {
      const next = [...prev];
      const draggedIdx = next.findIndex(f => f.id === draggedId);
      if (draggedIdx !== -1) {
        const [removed] = next.splice(draggedIdx, 1);
        // 更新父级ID
        removed.parentId = parentId;
        removed.sortOrder = nextSortOrder;
        // 重新添加到数组中（实际顺序会在重新加载时由后端决定）
        next.push(removed);
      }
      return next;
    });
  };

  // Photo operations
  const handleUpdatePhoto = async (id: string, updates: Partial<Photo>) => {
    const target = photos.find(p => p.id === id);
    if (target) {
      await photoService.updatePhoto(target, updates);
      setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    }
  };

  const handleToggleFavorite = (id: string) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
  };

  const handleDeletePhoto = async (id: string) => {
    await photoService.deletePhoto(id);
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  // Tag operations
  const handleDeleteTag = (tagId: string) => {
    setShowDeleteTagConfirm({ show: true, tagId });
  };

  const handleDeleteTagConfirm = async () => {
    const tagId = showDeleteTagConfirm.tagId;
    const tag = tags.find(t => t.id === tagId);
    if (tag) {
      await tagService.removeTagFromAllPhotos(tag.name, photos);
      setTags(prev => prev.filter(t => t.id !== tagId));
      setPhotos(prev => prev.map(p => ({
        ...p,
        tags: p.tags?.filter(t => t !== tag.name) || []
      })));
    }
    setShowDeleteTagConfirm({ show: false, tagId: '' });
  };

  // Directory operations
  const handleDirectoryClearPhotos = (folderId: string) => {
    setCurrentDirectoryId(folderId);
    setShowDirectoryClearConfirm(true);
  };

  const handleDirectoryClearPhotosConfirm = async () => {
    // 清空文件夹照片的逻辑
    await folderService.clearFolderPhotos(currentDirectoryId);
    setPhotos(prev => prev.filter(p => p.folderId !== currentDirectoryId));
    setShowDirectoryClearConfirm(false);
  };

  const handleDirectoryDeleteFolder = (folderId: string) => {
    setCurrentDirectoryId(folderId);
    setShowDirectoryDeleteConfirm(true);
  };

  const handleDirectoryDeleteFolderConfirm = async () => {
    await folderService.deleteFolder(currentDirectoryId);
    setFolders(prev => prev.filter(f => f.id !== currentDirectoryId));
    setShowDirectoryDeleteConfirm(false);
  };

  // Other operations
  const handleAddTag = (tag: Tag) => {
    setTags(prev => [...prev, tag]);
  };

  const handleRecipesChange = (newRecipes: Recipe[]) => {
    setRecipes(newRecipes);
  };

  const handleUpdateFolder = (id: string, updates: Partial<Folder>) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleRecognizeRecipe = async (photo: Photo) => {
    try {
      if (window.electronAPI?.recognizeRecipe) {
        const recipe = await window.electronAPI.recognizeRecipe(photo.filePath);
        if (recipe) {
          console.log('Recognized recipe:', recipe);
          alert('Recipe recognized successfully!');
        } else {
          alert('No recipe found for this photo.');
        }
      } else {
        alert('AI recipe recognition is not available in this mode. Please manually select a recipe.');
      }
    } catch (err) {
      console.error('Error recognizing recipe:', err);
      alert('Failed to recognize recipe.');
    }
  };

  const handleReParse = async (photo: Photo) => {
    try {
      if (window.electronAPI?.parseMetadata) {
        const metadata = await window.electronAPI.parseMetadata(photo.filePath);
        if (metadata) {
          console.log('[handleReParse] Raw metadata:', metadata);
          
          const parseDateTime = (dt: any): string | undefined => {
            if (!dt) return undefined;
            if (typeof dt === 'string') {
              const normalized = dt.replace(/^(\d{4}):(\d{2}):(\d{2})\s+/, '$1-$2-$3T');
              return normalized;
            }
            if (dt instanceof Date) return dt.toISOString();
            if (typeof dt === 'object') {
              if (dt.year && dt.month && dt.day) {
                const pad = (n: number) => String(n).padStart(2, '0');
                let result = `${dt.year}-${pad(dt.month)}-${pad(dt.day)}`;
                if (dt.hour !== undefined) {
                  result += `T${pad(dt.hour)}:${pad(dt.minute)}:${pad(dt.second)}`;
                }
                return result;
              }
              if (dt.rawValue) {
                const normalized = String(dt.rawValue).replace(/^(\d{4}):(\d{2}):(\d{2})\s+/, '$1-$2-$3T');
                return normalized;
              }
              return undefined;
            }
            return undefined;
          };
          
          let dateTimeValue: string | undefined;
          if (metadata.DateTimeOriginal) {
            dateTimeValue = parseDateTime(metadata.DateTimeOriginal);
          } else if (metadata.CreateDate) {
            dateTimeValue = parseDateTime(metadata.CreateDate);
          } else if (metadata.FileModifyDate) {
            dateTimeValue = parseDateTime(metadata.FileModifyDate);
          }
          
          const updates = {
            metadataJson: JSON.stringify(metadata),
          };
          
          if (dateTimeValue) {
            updates.dateTime = dateTimeValue;
          }
          
          console.log('[handleReParse] Updates:', updates);
          
          await handleUpdatePhoto(photo.id, updates);
          
          setSelectedPhoto(prev => prev ? { ...prev, ...updates, metadataJson: metadata } : null);
        } else {
          console.warn('[handleReParse] No metadata found');
        }
      } else {
        console.warn('[handleReParse] parseMetadata not available');
      }
    } catch (err) {
      console.error('Error re-parsing metadata:', err);
    }
  };



  // Sidebar resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    isResizingRef.current = true;
    // 添加事件监听器
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResize = (e: MouseEvent) => {
    if (!isResizingRef.current || !sidebarRef.current) return;
    
    const rect = sidebarRef.current.getBoundingClientRect();
    const newWidth = e.clientX - rect.left;
    if (newWidth > 200 && newWidth < 500) {
      setSidebarWidth(newWidth);
    }
  };

  const handleResizeEnd = () => {
    isResizingRef.current = false;
    // 移除事件监听器
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  useEffect(() => {
    // 不需要在依赖数组中包含isResizingRef.current
    // 因为useRef的current属性的变化不会触发useEffect的重新执行
    return () => {
      // 清理事件监听器
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  return (
    <div className={cn(
      "h-screen w-screen flex overflow-hidden font-sans transition-colors duration-300",
      theme === 'dark' ? "dark bg-[#0a0a0a] text-white" : "bg-slate-50 text-slate-900"
    )}>
      {/* Sidebar */}
      <div 
        ref={sidebarRef}
        className="flex flex-col bg-[var(--bg-secondary)]/50 backdrop-blur-xl border-r border-[var(--border-color)]"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="flex-1">
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Images className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">Fuji Store</span>
          </div>

          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            <NavItem 
              icon={<Images className="w-4 h-4" />} 
              label={t('nav.allPhotos')} 
              active={activeView === 'photos'} 
              onClick={() => {
                setActiveFolderId(null);
                setActiveView('photos');
              }} 
              theme={theme}
            />
            <NavItem 
              icon={<Clock className="w-4 h-4" />} 
              label={t('nav.timeline')} 
              active={activeView === 'timeline'} 
              onClick={() => setActiveView('timeline')} 
              theme={theme}
            />
            <NavItem 
              icon={<Heart className="w-4 h-4" />} 
              label={t('nav.favorites')} 
              active={activeView === 'favorites'} 
              onClick={() => setActiveView('favorites')} 
              theme={theme}
            />
            <NavItem 
              icon={<Tags className="w-4 h-4" />} 
              label={t('nav.tags')} 
              active={activeView === 'tags'} 
              onClick={() => setActiveView('tags')} 
              theme={theme}
            />
            <NavItem 
              icon={<BarChart3 className="w-4 h-4" />} 
              label={t('nav.stats')} 
              active={activeView === 'stats'} 
              onClick={() => setActiveView('stats')} 
              theme={theme}
            />
            <NavItem 
              icon={<FlaskConical className="w-4 h-4" />} 
              label={t('nav.recipes')} 
              active={activeView === 'recipes'} 
              onClick={() => setActiveView('recipes')} 
              theme={theme}
            />
            <NavItem 
              icon={<Palette className="w-4 h-4" />} 
              label={t('nav.templates')} 
              active={activeView === 'templates'} 
              onClick={() => setActiveView('templates')} 
              theme={theme}
            />

            <div 
              className="pt-8 pb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const draggedFolderId = e.dataTransfer.getData('folderId');
                if (draggedFolderId) {
                  handleFolderReorder(draggedFolderId, ROOT_PARENT_ID);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              {t('nav.directories')}
              <button 
                onClick={() => {
                  setImportModalInitialType('folders');
                  setImportMode('create');
                  setFolderName('');
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
                  await folderService.deleteFolder(folderId);
                  setFolders(prev => prev.filter(f => f.id !== folderId));
                }}
                onClearPhotos={handleDirectoryClearPhotos}
                onDeleteFolderConfirm={handleDirectoryDeleteFolder}
                onOpenFolderPath={async (folderPath) => {
                  if (!folderPath || !window.electronAPI?.openFolderPath) return;
                  const result = await window.electronAPI.openFolderPath(folderPath);
                  if (!result?.success) {
                    console.error('Open physical folder failed:', result?.error);
                  }
                }}
                onShowFolderInfo={setShowFolderInfo}
              />
            </div>
          </nav>
        </div>

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
              {theme === 'dark' ? <div className="w-4 h-4" /> : <div className="w-4 h-4" />}
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
            {t('nav.settings')}
          </button>
        </div>
      </div>
      
      {/* Resize handle */}
      <div 
        className="w-1 bg-[var(--border-color)] cursor-col-resize hover:bg-blue-500/30 transition-colors"
        onMouseDown={handleResizeStart}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[var(--bg-primary)]">
        <div className="absolute top-4 right-6 z-20">
          <button
            onClick={() => setShowImportTasks(v => !v)}
            className="relative p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)]/85 backdrop-blur-xl text-slate-500 hover:text-blue-500 hover:border-blue-500/40 transition-all"
            title="导入任务"
          >
            <ListTodo className="w-4 h-4" />
            {(queueCount + runningCount) > 0 && (
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-blue-500 text-white text-[10px] font-black flex items-center justify-center">
                {queueCount + runningCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {showImportTasks && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-3 w-[360px] max-h-[420px] overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur-2xl shadow-2xl p-3 space-y-2"
              >
                {importTasks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">暂无导入任务</div>
                ) : (
                  importTasks.slice().reverse().map(task => (
                    <div key={task.id} className="rounded-xl border border-[var(--border-color)] p-3 bg-slate-500/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-bold truncate pr-2">{task.name}</div>
                        <div className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          task.status === 'running' ? "text-blue-500" :
                          task.status === 'done' ? "text-green-500" :
                          task.status === 'cancelled' ? "text-slate-400" :
                          task.status === 'error' ? "text-red-500" : "text-slate-400"
                        )}>
                          {task.status}
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-500/10 overflow-hidden mb-2">
                        <div
                          className={cn(
                            "h-full transition-all",
                            task.status === 'error' ? "bg-red-500" : "bg-gradient-to-r from-blue-500 to-indigo-600"
                          )}
                          style={{ width: `${Math.max(0, Math.min(100, task.progress || 0))}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-400">
                        成功 {task.success} · 失败 {task.failed} · 跳过 {task.skipped}
                      </div>
                      {(task.status === 'queued' || task.status === 'running') && (
                        <div className="mt-2">
                          <button
                            onClick={() => void handleCancelImportTask(task)}
                            className="text-[11px] font-bold text-red-500 hover:text-red-600"
                          >
                            取消任务
                          </button>
                        </div>
                      )}
                      {task.error && <div className="text-[11px] text-red-400 mt-1 truncate">{task.error}</div>}
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Header / Toolbar - Conditionally rendered */}
        {(activeView === 'photos' || activeView === 'favorites') && (
          <header className="h-20 border-b border-[var(--border-color)] flex items-center justify-between px-8 bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 z-10">
            <div className="flex items-center gap-6 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder={t('filter.search')} 
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
                  {t('filter.jpg')}
                </button>
                <button 
                  onClick={() => setFilterExtension('RAF')}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-black transition-all", filterExtension === 'RAF' ? "bg-blue-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600")}
                >
                  {t('filter.raf')}
                </button>
                <button 
                  onClick={() => setFilterExtension('All')}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-black transition-all", filterExtension === 'All' ? "bg-blue-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600")}
                >
                  {t('filter.all')}
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
                {t('filter.advanced')}
              </button>

              <button 
                onClick={() => {
                  setImportModalInitialType('files');
                  setImportMode('import');
                  setFolderName('');
                  setIsImportModalOpen(true);
                }}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                {t('importBtn')}
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('filter.dateFilter')}</label>
                    {filterDate && (
                      <button 
                        onClick={() => setFilterDate('')}
                        className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline"
                      >
                        {t('filter.reset')}
                      </button>
                    )}
                  </div>
                  <CustomDatePicker 
                    value={filterDate}
                    onChange={setFilterDate}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      { label: t('filter.all'), value: '' },
                      { label: t('filter.today'), value: new Date().toISOString().split('T')[0] },
                      { label: t('filter.days7'), value: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] },
                      { label: t('filter.month'), value: new Date().toISOString().slice(0, 7) }
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('filter.filmSimulation')}</label>
                    {filterFilmMode !== 'All' && (
                      <button 
                        onClick={() => setFilterFilmMode('All')}
                        className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline"
                      >
                        {t('filter.reset')}
                      </button>
                    )}
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder={t('filter.filmSimulation') + '...'}
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
                          {mode === 'All' ? t('filter.all') : (FILM_SHORT_CODES[mode] || mode)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-3 col-span-1 md:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('filter.tags')}</label>
                    {selectedTags.length > 0 && (
                      <button 
                        onClick={() => setSelectedTags([])}
                        className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline"
                      >
                        {t('filter.clear')} ({selectedTags.length})
                      </button>
                    )}
                  </div>
                  
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
                      placeholder={t('filter.tags') + '...'}
                      className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500/50 transition-all"
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="maxh-32 overflow-y-auto pr-2 custom-scrollbar">
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
                        <p className="text-[10px] text-slate-500 italic w-full text-center py-2">{t('filter.noTagsFound')}</p>
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
                    <RefreshCw className="w-3 h-3" />
                    {t('filter.resetAllFilters')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="py-20 max-w-xl mx-auto space-y-4">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>{bootProgress.text || t('loading')}</span>
                <span>{bootProgress.percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-500/10 overflow-hidden border border-[var(--border-color)]">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200"
                  style={{ width: `${bootProgress.percent}%` }}
                />
              </div>
              <div className="text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                {bootProgress.completed}/{bootProgress.total || 0}
                {bootProgress.failed > 0 ? ` · 跳过 ${bootProgress.failed}` : ''}
              </div>
            </div>
          ) : error ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <p className="font-medium text-red-500">Error loading data: {error}</p>
              <button 
                onClick={reload}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all"
              >
                {t('retry')}
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeView === 'stats' ? (
                <StatsView key="stats" photos={photos} theme={theme} />
              ) : activeView === 'templates' ? (
                <TemplatesView 
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
                <RecipeView key="recipes" recipes={recipes} photos={photos} user={user} theme={theme} onRecipesChange={handleRecipesChange} metadataFields={metadataFields} displayConfig={configLoaded ? displayConfig : undefined} />
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
                  cloudSyncEnabled={cloudSyncEnabled}
                  setCloudSyncEnabled={setCloudSyncEnabled}
                  thumbnailDir={thumbnailDir}
                  onCacheDirChange={async (dir) => {
                    if (window.electronAPI?.setThumbnailDir) {
                      await window.electronAPI.setThumbnailDir(dir);
                    }
                  }}
                  onOpenMetadataParser={() => {
                    setPreviousView('settings');
                    setActiveView('metadataParser');
                  }}
                />
              ) : activeView === 'metadataParser' ? (
                <MetadataParserView 
                  key="metadataParser"
                  onBack={() => {
                    setActiveView(previousView || 'settings');
                  }}
                  onFieldsChange={(fields) => {
                    setMetadataFields(fields);
                  }}
                  onDisplayConfigChange={handleDisplayConfigChange}
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
                        {filteredPhotos.length} {t('itemsInView')}
                      </p>
                    </div>

                    {/* Top Sorting UI */}
                    <div className="flex items-center gap-3 bg-slate-500/5 p-2 rounded-2xl border border-[var(--border-color)] backdrop-blur-md">
                      <div className="flex items-center gap-2 px-3 border-r border-[var(--border-color)]">
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('sort.sort')}</span>
                      </div>
                      <div className="flex gap-2">
                        {[
                          { label: t('sort.date'), value: 'date' },
                          { label: t('sort.name'), value: 'name' },
                          { label: t('sort.size'), value: 'size' }
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
                        onClick={() => configLoaded && setSelectedPhoto(photo)} 
                        theme={theme}
                        onToggleFavorite={handleToggleFavorite}
                        onDeletePhoto={handleDeletePhoto}
                        displayConfig={configLoaded ? displayConfig : undefined}
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
          )}
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
            onReParse={handleReParse}
            theme={theme}
            allTags={tags}
            onExport={() => {
              setExportPhoto(selectedPhoto);
              setIsExportModalOpen(true);
            }}
            onUpdatePhoto={handleUpdatePhoto}
            onDeletePhoto={handleDeletePhoto}
            onAddTag={handleAddTag}
            displayConfig={configLoaded ? displayConfig : undefined}
            metadataFields={metadataFields}
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
            onImportCompleted={async () => {
              setPhotoPage(1);
              setHasMorePhotos(true);
              await reload();
            }}
            onQueueImport={handleQueueImport}
          />
        )}
        {isSyncModalOpen && syncFolderId && (
          <SyncFolderModal
            onClose={() => setIsSyncModalOpen(false)}
            folderId={syncFolderId}
            folders={folders}
            setPhotos={setPhotos}
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
        {showDeleteTagConfirm.show && (
          <ConfirmModal
            title="删除标签"
            message="确定要删除此标签吗？这将从所有照片中移除该标签。"
            confirmLabel="删除"
            onConfirm={handleDeleteTagConfirm}
            onCancel={() => setShowDeleteTagConfirm({ show: false, tagId: '' })}
          />
        )}
        {showDirectoryClearConfirm && (
          <ConfirmModal
            title="清空文件夹"
            message="确定要清空此文件夹中的所有照片吗？"
            confirmLabel="清空"
            onConfirm={handleDirectoryClearPhotosConfirm}
            onCancel={() => setShowDirectoryClearConfirm(false)}
          />
        )}
        {showDirectoryDeleteConfirm && (
          <ConfirmModal
            title="删除文件夹"
            message="确定要删除此文件夹吗？这将同时删除该文件夹中的所有照片。"
            confirmLabel="删除"
            onConfirm={handleDirectoryDeleteFolderConfirm}
            onCancel={() => setShowDirectoryDeleteConfirm(false)}
          />
        )}
        {showFolderInfo && (
          <FolderInfoModal 
            folder={showFolderInfo}
            onCancel={() => setShowFolderInfo(null)}
            onSelectNewPath={() => {
              // 这里可以实现重新选择物理目录的逻辑
              console.log('Select new path');
              setShowFolderInfo(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
