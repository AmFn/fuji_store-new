import React, { useState, useEffect, useMemo } from 'react';
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
  RefreshCw
} from 'lucide-react';

import { cn } from './lib/utils';
import { Photo, Recipe, Tag, Folder } from './types';
import { FILM_MODES, FILM_SHORT_CODES, COLORS } from './constants/filmModes';
import { isPhotoInFolder } from './utils/fileUtils';

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
import { ImportModal } from './components/modals/ImportModal';
import { SyncFolderModal } from './components/modals/SyncFolderModal';

// Views
import { StatsView } from './components/views/StatsView';
import { TagsView } from './components/views/TagsView';
import { SettingsView } from './components/views/SettingsView';
import { RecipeView } from './components/views/RecipeView';
import { TimelineView } from './components/views/TimelineView';

// Mock User Type
interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

// 从服务层获取真实数据，不再使用模拟数据

export default function App() {
  // User state
  const [user, setUser] = useState<User | null>({ 
    uid: 'demo', 
    email: 'feng46042@gmail.com', 
    displayName: 'Fuji User',
    photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fuji'
  } as any);
  
  // View state
  const [activeView, setActiveView] = useState<'photos' | 'timeline' | 'recipes' | 'stats' | 'settings' | 'favorites' | 'hidden' | 'tags' | 'posters' | 'templates'>('photos');
  
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
  
  // Confirmation modal states
  const [showDirectoryClearConfirm, setShowDirectoryClearConfirm] = useState<boolean>(false);
  const [showDirectoryDeleteConfirm, setShowDirectoryDeleteConfirm] = useState<boolean>(false);
  const [currentDirectoryId, setCurrentDirectoryId] = useState<string>('');
  const [showDeleteTagConfirm, setShowDeleteTagConfirm] = useState<{ show: boolean, tagId: string }>({ show: false, tagId: '' });
  
  // Photo pagination
  const [photoPage, setPhotoPage] = useState(1);
  const [hasMorePhotos, setHasMorePhotos] = useState(true);
  const [loadingMorePhotos, setLoadingMorePhotos] = useState(false);
  const PHOTO_PAGE_SIZE = 120;
  
  // Search states
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  
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
    reload
  } = usePhotoLibrary();
  
  const { 
    photos: timelinePhotos, 
    loading: timelineLoading 
  } = useTimeline();

  // 不再使用模拟数据，依赖usePhotoLibrary钩子从服务层获取数据

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
        comparison = a.fileName.localeCompare(b.fileName);
      } else if (sortBy === 'date') {
        comparison = new Date(a.dateTime || '').getTime() - new Date(b.dateTime || '').getTime();
      } else if (sortBy === 'size') {
        comparison = parseInt(a.size || '0') - parseInt(b.size || '0');
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

  const handleDirectoryClearPhotosConfirm = () => {
    // 清空文件夹照片的逻辑
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



  const handleUpdateFolder = (id: string, updates: Partial<Folder>) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleRecognizeRecipe = async (photo: Photo) => {
    try {
      if (window.electronAPI?.recognizeRecipe) {
        const recipe = await window.electronAPI.recognizeRecipe(photo.filePath);
        if (recipe) {
          // 处理识别到的食谱
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
                  setImportMode('import');
                  setFolderName('');
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
                    <RefreshCw className="w-3 h-3" />
                    Reset All Filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="py-20 text-center text-xs font-black uppercase tracking-widest text-slate-400">
              Loading data...
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
                Retry
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
            {activeView === 'stats' ? (
              <StatsView key="stats" photos={photos} theme={theme} />
            ) : activeView === 'templates' ? (
              <div key="templates" className="flex flex-col items-center justify-center py-32 text-slate-400 space-y-6">
                <div className="w-20 h-20 bg-slate-500/5 rounded-full flex items-center justify-center">
                  <Palette className="w-10 h-10 opacity-20" />
                </div>
                <p className="font-medium">Templates feature coming soon</p>
              </div>
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
            setPhotos={setPhotos}
          />
        )}
        {isExportModalOpen && exportPhoto && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Export Photo</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Save photo to your device</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="glass-card rounded-3xl p-6 border-2 border-dashed border-slate-500/20 hover:border-blue-500/50 transition-all cursor-pointer"
                  >
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="font-bold text-lg text-center">Original</h3>
                      <p className="text-sm text-slate-400 text-center">Export as original file</p>
                    </div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="glass-card rounded-3xl p-6 border-2 border-dashed border-slate-500/20 hover:border-blue-500/50 transition-all cursor-pointer"
                  >
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </div>
                      <h3 className="font-bold text-lg text-center">JPEG</h3>
                      <p className="text-sm text-slate-400 text-center">Export as JPEG format</p>
                    </div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="glass-card rounded-3xl p-6 border-2 border-dashed border-slate-500/20 hover:border-blue-500/50 transition-all cursor-pointer"
                  >
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <h3 className="font-bold text-lg text-center">PNG</h3>
                      <p className="text-sm text-slate-400 text-center">Export as PNG format</p>
                    </div>
                  </motion.div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-lg">Export Options</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded-xl border-2 border-slate-500/30 bg-slate-500/5 checked:bg-blue-500 checked:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                      <span className="text-sm font-medium">Include EXIF metadata</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded-xl border-2 border-slate-500/30 bg-slate-500/5 checked:bg-blue-500 checked:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                      <span className="text-sm font-medium">Include recipe information</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded-xl border-2 border-slate-500/30 bg-slate-500/5 checked:bg-blue-500 checked:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                      <span className="text-sm font-medium">Resize image</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsExportModalOpen(false)}
                    className="flex-1 py-4 border border-[var(--border-color)] text-slate-300 rounded-2xl text-sm font-bold hover:bg-slate-500/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Export Photo
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
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
            message="确定要删除此文件夹吗？"
            confirmLabel="删除"
            onConfirm={handleDirectoryDeleteFolderConfirm}
            onCancel={() => setShowDirectoryDeleteConfirm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}