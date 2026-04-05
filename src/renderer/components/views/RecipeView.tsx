import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit3, Share2, Film, Eye, ChevronRight, X, Trash2, Image as ImageIcon, ChevronLeft, ChevronDown, RefreshCw } from 'lucide-react';
import { Recipe, Photo, User } from '../../types';
import { FILM_MODES } from '../../constants/filmModes';
import { cn } from '../../lib/utils';
import { CustomSelect } from '../common/CustomSelect';
import { FilmTag } from '../common/FilmTag';
import { FilmSettingCard } from '../common/FilmSettingCard';
import { recipeService } from '../../services/recipeService';
import { ConfirmModal } from '../modals/ConfirmModal';
import { useLanguage } from '../../hooks/useLanguage';
import { convertDbPhotoToPhoto } from '../../utils/fileUtils';

interface RecipeViewProps {
  recipes: Recipe[];
  photos: Photo[];
  user: User | null;
  theme: string;
  onRecipesChange: (recipes: Recipe[]) => void;
}

const DEFAULT_RECIPE_FORM: Partial<Recipe> = {
  name: '',
  filmMode: 'Classic Chrome',
  whiteBalance: 'Auto',
  whiteBalanceShift: '0, 0',
  dynamicRange: 'DR100',
  sharpness: '0',
  saturation: '0',
  contrast: '0',
  highlightTone: '0',
  shadowTone: '0',
  noiseReduction: '0',
  clarity: '0',
  grainEffect: 'Off, Off',
  colorChromeEffect: 'Off',
  colorChromeEffectBlue: 'Off',
  isFavorite: false,
};

const CAROUSEL_ASPECT_OPTIONS = [
  { key: '1:1', label: '1:1', ratio: 1, className: 'aspect-square' },
  { key: '5:4', label: '5:4', ratio: 5 / 4, className: 'aspect-[5/4]' },
  { key: '4:3', label: '4:3', ratio: 4 / 3, className: 'aspect-[4/3]' },
  { key: '7:6', label: '7:6', ratio: 7 / 6, className: 'aspect-[7/6]' },
  { key: '3:2', label: '3:2', ratio: 3 / 2, className: 'aspect-[3/2]' },
  { key: '16:10', label: '16:10', ratio: 16 / 10, className: 'aspect-[16/10]' },
  { key: '16:9', label: '16:9', ratio: 16 / 9, className: 'aspect-[16/9]' },
  { key: '17:9', label: '17:9', ratio: 17 / 9, className: 'aspect-[17/9]' },
  { key: '2:1', label: '2:1', ratio: 2 / 1, className: 'aspect-[2/1]' },
  { key: '65:24', label: '65:24', ratio: 65 / 24, className: 'aspect-[65/24]' },
];

const getClosestAspectOption = (width: number, height: number) => {
  if (!width || !height) return CAROUSEL_ASPECT_OPTIONS.find((o) => o.key === '3:2') || CAROUSEL_ASPECT_OPTIONS[0];
  const target = width / height;
  return CAROUSEL_ASPECT_OPTIONS.reduce((best, current) => {
    const bestDiff = Math.abs(best.ratio - target);
    const currentDiff = Math.abs(current.ratio - target);
    return currentDiff < bestDiff ? current : best;
  }, CAROUSEL_ASPECT_OPTIONS[0]);
};

export function RecipeView({ recipes, photos, user, theme, onRecipesChange }: RecipeViewProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [recipePhotosMap, setRecipePhotosMap] = useState<Record<string, Photo[]>>({});
  const [thumbnailDir, setThumbnailDir] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lockedRecipeDetailId, setLockedRecipeDetailId] = useState<string | null>(null);
  const [selectedAspectKey, setSelectedAspectKey] = useState<string>('3:2');
  const [aspectManuallyChanged, setAspectManuallyChanged] = useState(false);
  const [aspectOptionsExpanded, setAspectOptionsExpanded] = useState(false);
  const getDefaultRecipeForm = (): Partial<Recipe> => ({
    ...DEFAULT_RECIPE_FORM,
    ownerId: user?.uid || 'local',
  });
  const [newRecipe, setNewRecipe] = useState<Partial<Recipe>>(getDefaultRecipeForm);

  useEffect(() => {
    loadRecipes();
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.getThumbnailDir) return;
    window.electronAPI.getThumbnailDir().then(setThumbnailDir).catch(() => setThumbnailDir(null));
  }, []);

  const loadRecipes = async () => {
    setLoading(true);
    const loadedRecipes = await recipeService.loadAllRecipes();
    onRecipesChange(loadedRecipes);
    await hydrateRecipePhotos(loadedRecipes);
    setLoading(false);
  };

  const toPreviewUrl = (filePath: string) => {
    const normalized = (filePath || '').replace(/\\/g, '/');
    return `file:///${encodeURI(normalized)}`;
  };

  const loadRecipePhotos = async (recipeId: string, pageSize = 60): Promise<Photo[]> => {
    if (!window.electronAPI?.getPhotosByRecipe) return [];
    const res = await window.electronAPI.getPhotosByRecipe(Number(recipeId), 1, pageSize);
    return (res?.items || []).map((p: any) => convertDbPhotoToPhoto(p, thumbnailDir));
  };

  const hydrateRecipePhotos = async (targetRecipes: Recipe[]) => {
    if (!window.electronAPI?.getPhotosByRecipe || targetRecipes.length === 0) {
      setRecipePhotosMap({});
      return;
    }
    const entries = await Promise.all(targetRecipes.map(async (recipe) => {
      const items = await loadRecipePhotos(recipe.id, 12);
      return [recipe.id, items] as const;
    }));
    setRecipePhotosMap(Object.fromEntries(entries));
  };

  const handleCreate = async () => {
    if (!newRecipe.name) return;
    const created = await recipeService.createRecipe(newRecipe);
    if (created) {
      if (selectedImages.length > 0 && window.electronAPI?.addRecipeDisplayPhotos) {
        await window.electronAPI.addRecipeDisplayPhotos(Number(created.id), selectedImages);
      }
      const nextRecipes = [...recipes, created];
      onRecipesChange(nextRecipes);
      await hydrateRecipePhotos(nextRecipes);
      setIsCreating(false);
      resetForm();
      setSelectedImages([]);
      setIsAnalyzing(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingRecipe) return;
    const success = await recipeService.updateRecipe(editingRecipe);
    if (success) {
      onRecipesChange(recipes.map(r => r.id === editingRecipe.id ? editingRecipe : r));
      setEditingRecipe(null);
    }
  };

  const handleDelete = async (recipeId: string) => {
    const success = await recipeService.deleteRecipe(recipeId);
    if (success) {
      onRecipesChange(recipes.filter(r => r.id !== recipeId));
      if (selectedRecipeId === recipeId) {
        setSelectedRecipeId(null);
      }
    }
    setShowDeleteConfirm(null);
  };

  const resetForm = () => {
    setNewRecipe(getDefaultRecipeForm());
  };

  const filteredRecipes = recipes.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.filmMode && r.filmMode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId) || detailRecipe;
  const recipePhotos = selectedRecipeId ? (recipePhotosMap[selectedRecipeId] || []) : [];
  const firstCarouselImage = recipePhotos[0]?.thumbnailUrl || '';
  const activeAspectOption = CAROUSEL_ASPECT_OPTIONS.find((o) => o.key === selectedAspectKey) || CAROUSEL_ASPECT_OPTIONS[4];
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const scrollAmount = carouselRef.current.clientWidth;
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };
  
  const handleImageSelect = async () => {
    if (!window.electronAPI?.pickFiles) return;
    const picked = await window.electronAPI.pickFiles();
    if (!picked || picked.length === 0) return;
    setSelectedImages(prev => [...prev, ...picked]);
  };

  const handleAddPhotosToRecipe = async (recipeId: string) => {
    if (!window.electronAPI?.pickFiles || !window.electronAPI?.addRecipeDisplayPhotos) return;
    setLockedRecipeDetailId(recipeId);
    setSelectedRecipeId(recipeId);
    try {
      const picked = await window.electronAPI.pickFiles();
      if (!picked || picked.length === 0) return;
      await window.electronAPI.addRecipeDisplayPhotos(Number(recipeId), picked);
      const items = await loadRecipePhotos(recipeId, 60);
      setRecipePhotosMap(prev => ({ ...prev, [recipeId]: items }));
      setSelectedRecipeId(recipeId);
    } finally {
      setLockedRecipeDetailId(null);
    }
  };

  const handleRemovePhotoFromRecipe = async (recipeId: string, photoId: string) => {
    if (!window.electronAPI?.removeRecipeFromPhoto) return;
    await window.electronAPI.removeRecipeFromPhoto(Number(photoId), Number(recipeId));
    const items = await loadRecipePhotos(recipeId, 60);
    setRecipePhotosMap((prev) => ({ ...prev, [recipeId]: items }));
    setSelectedRecipeId(recipeId);
  };

  const handleRecognizeRecipe = async () => {
    const defaults = getDefaultRecipeForm();
    if (selectedImages.length === 0) {
      setNewRecipe((prev) => ({ ...defaults, ...prev }));
      return;
    }
    setIsAnalyzing(true);
    try {
      let recognized: any = null;
      if (window.electronAPI?.recognizeRecipe) {
        recognized = await window.electronAPI.recognizeRecipe(selectedImages[0]);
      }
      if (!recognized || typeof recognized !== 'object') {
        setNewRecipe((prev) => ({ ...defaults, ...prev }));
        return;
      }
      setNewRecipe((prev) => ({
        ...defaults,
        ...prev,
        name: recognized.name || recognized.recipeName || prev.name || '',
        description: recognized.description || prev.description || '',
        filmMode: recognized.film_mode || recognized.filmMode || prev.filmMode || defaults.filmMode,
        whiteBalance: recognized.white_balance || recognized.whiteBalance || prev.whiteBalance || defaults.whiteBalance,
        whiteBalanceShift: recognized.white_balance_shift || recognized.whiteBalanceShift || prev.whiteBalanceShift || defaults.whiteBalanceShift,
        dynamicRange: recognized.dynamic_range || recognized.dynamicRange || prev.dynamicRange || defaults.dynamicRange,
        sharpness: String(recognized.sharpness ?? prev.sharpness ?? defaults.sharpness),
        saturation: String(recognized.saturation ?? recognized.color ?? prev.saturation ?? defaults.saturation),
        contrast: String(recognized.contrast ?? prev.contrast ?? defaults.contrast),
        clarity: String(recognized.clarity ?? prev.clarity ?? defaults.clarity),
        shadowTone: String(recognized.shadow_tone ?? recognized.shadowTone ?? prev.shadowTone ?? defaults.shadowTone),
        highlightTone: String(recognized.highlight_tone ?? recognized.highlightTone ?? prev.highlightTone ?? defaults.highlightTone),
        noiseReduction: String(recognized.noise_reduction ?? recognized.noiseReduction ?? prev.noiseReduction ?? defaults.noiseReduction),
        grainEffect: recognized.grain_effect || recognized.grainEffect || prev.grainEffect || defaults.grainEffect,
        colorChromeEffect: recognized.color_chrome_effect || recognized.colorChromeEffect || prev.colorChromeEffect || defaults.colorChromeEffect,
        colorChromeEffectBlue: recognized.color_chrome_effect_blue || recognized.colorChromeEffectBlue || prev.colorChromeEffectBlue || defaults.colorChromeEffectBlue,
      }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!selectedRecipeId) return;
    if (recipePhotosMap[selectedRecipeId]) return;
    loadRecipePhotos(selectedRecipeId, 60)
      .then((items) => setRecipePhotosMap((prev) => ({ ...prev, [selectedRecipeId]: items })))
      .catch(() => {});
  }, [selectedRecipeId, recipePhotosMap]);

  useEffect(() => {
    if (!lockedRecipeDetailId) return;
    if (selectedRecipeId === lockedRecipeDetailId) return;
    setSelectedRecipeId(lockedRecipeDetailId);
  }, [lockedRecipeDetailId, selectedRecipeId]);

  useEffect(() => {
    setAspectManuallyChanged(false);
    setAspectOptionsExpanded(false);
  }, [selectedRecipeId]);

  useEffect(() => {
    if (!firstCarouselImage || aspectManuallyChanged) return;
    const img = new Image();
    img.onload = () => {
      const closest = getClosestAspectOption(img.naturalWidth, img.naturalHeight);
      setSelectedAspectKey(closest.key);
    };
    img.src = firstCarouselImage;
  }, [firstCarouselImage, aspectManuallyChanged]);

  useEffect(() => {
    if (!selectedRecipeId) {
      setDetailRecipe(null);
      return;
    }
    const current = recipes.find((r) => r.id === selectedRecipeId);
    if (current) {
      setDetailRecipe(current);
    }
  }, [recipes, selectedRecipeId]);

  const renderRecipeForm = (recipe: Partial<Recipe>, setRecipe: (r: Partial<Recipe>) => void, onSubmit: () => void, submitLabel: string) => (
    <div className="p-10 space-y-10 overflow-y-auto custom-scrollbar">
      {/* Image Selection Section */}
      <div className="space-y-6">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('recipe.recipePhotos')}</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {selectedImages.map((filePath, i) => (
            <div key={i} className="aspect-square rounded-2xl overflow-hidden bg-slate-500/10 relative group">
              <img src={toPreviewUrl(filePath)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <button 
                onClick={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-md text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleImageSelect}
            className="aspect-square rounded-2xl border-2 border-dashed border-[var(--border-color)] flex flex-col items-center justify-center space-y-2 hover:bg-slate-500/5 transition-all cursor-pointer group"
          >
            <Plus className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-500">{t('recipe.addPhoto')}</span>
          </button>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleRecognizeRecipe}
            className="px-4 py-2 bg-slate-500/10 hover:bg-slate-500/15 rounded-xl text-[10px] font-black uppercase tracking-widest border border-[var(--border-color)]"
          >
            识别
          </button>
        </div>
        {isAnalyzing && (
          <div className="flex items-center gap-3 text-blue-500 bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">识别中</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('recipe.recipeName')}</label>
        <input 
          type="text" 
          className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold"
          placeholder="e.g. Kodachrome 64"
          value={recipe.name || ''}
          onChange={e => setRecipe({ ...recipe, name: e.target.value })}
        />
      </div>
      
      <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('recipe.description')}</label>
        <textarea 
          className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold min-h-[80px]"
          placeholder={t('recipe.descriptionPlaceholder')}
          value={recipe.description || ''}
          onChange={e => setRecipe({ ...recipe, description: e.target.value })}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('recipe.filmMode')}</label>
            <CustomSelect 
              value={recipe.filmMode || ''}
              onChange={(val) => setRecipe({ ...recipe, filmMode: val })}
              options={FILM_MODES.map(m => ({ label: m, value: m }))}
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('recipe.whiteBalance')}</label>
            <input 
              type="text" 
              className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
              placeholder="Auto"
              value={recipe.whiteBalance || ''}
              onChange={e => setRecipe({ ...recipe, whiteBalance: e.target.value })}
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('recipe.wbShift')}</label>
            <input 
              type="text" 
              className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
              placeholder="0, 0"
              value={recipe.whiteBalanceShift || ''}
              onChange={e => setRecipe({ ...recipe, whiteBalanceShift: e.target.value })}
            />
          </div>
          <Slider 
            label={t('recipe.sharpness')} 
            value={Number(recipe.sharpness || 0)} 
            onChange={(val) => setRecipe({ ...recipe, sharpness: val.toString() })} 
          />
          <Slider 
            label={t('recipe.color')} 
            value={Number(recipe.saturation || 0)} 
            onChange={(val) => setRecipe({ ...recipe, saturation: val.toString() })} 
          />
          <Slider 
            label={t('recipe.noiseReduction')} 
            value={Number(recipe.noiseReduction || 0)} 
            onChange={(val) => setRecipe({ ...recipe, noiseReduction: val.toString() })} 
          />
          <Slider 
            label={t('recipe.clarity')} 
            value={Number(recipe.clarity || 0)} 
            onChange={(val) => setRecipe({ ...recipe, clarity: val.toString() })} 
          />
        </div>

        <div className="space-y-6">
          <Slider 
            label={t('recipe.highlight')} 
            value={Number(recipe.highlightTone || 0)} 
            onChange={(val) => setRecipe({ ...recipe, highlightTone: val.toString() })} 
          />
          <Slider 
            label={t('recipe.shadow')} 
            value={Number(recipe.shadowTone || 0)} 
            onChange={(val) => setRecipe({ ...recipe, shadowTone: val.toString() })} 
          />
          <Slider 
            label={t('recipe.contrast')} 
            value={Number(recipe.contrast || 0)} 
            onChange={(val) => setRecipe({ ...recipe, contrast: val.toString() })} 
          />
          <Switch 
            label={t('recipe.chromeFX')} 
            checked={recipe.colorChromeEffect === 'On'} 
            onChange={(val) => setRecipe({ ...recipe, colorChromeEffect: val ? 'On' : 'Off' })} 
          />
          <Switch 
            label={t('recipe.fxBlue')} 
            checked={recipe.colorChromeEffectBlue === 'On'} 
            onChange={(val) => setRecipe({ ...recipe, colorChromeEffectBlue: val ? 'On' : 'Off' })} 
          />
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('recipe.grainEffect')}</label>
            <input 
              type="text" 
              className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
              placeholder="Off, Off"
              value={recipe.grainEffect || ''}
              onChange={e => setRecipe({ ...recipe, grainEffect: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="py-20 text-center text-xs font-black uppercase tracking-widest text-slate-400">
          {t('recipe.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-black tracking-tight">{t('recipe.title')}</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('recipe.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder={t('recipe.searchPlaceholder')}
              className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl pl-12 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => { resetForm(); setIsCreating(true); }}
            className="bg-blue-500 text-white px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            {t('recipe.new')}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <div className={cn(
          "h-full grid grid-cols-1 lg:grid-cols-12 gap-10 transition-all duration-500",
          selectedRecipeId ? "opacity-0 pointer-events-none translate-x-[-20px]" : "opacity-100"
        )}>
          <div className="lg:col-span-12 h-full overflow-y-auto pr-4 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredRecipes.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-400 space-y-6">
              <div className="w-20 h-20 bg-slate-500/5 rounded-full flex items-center justify-center">
                <Film className="w-10 h-10 opacity-20" />
              </div>
              <p className="font-medium">{t('recipe.noRecipesFound')}</p>
              <button 
                onClick={() => { resetForm(); setIsCreating(true); }}
                className="text-blue-500 hover:underline"
              >
                {t('recipe.createFirst')}
              </button>
            </div>
          ) : (
            filteredRecipes.map(recipe => {
              const recipeCover = recipePhotosMap[recipe.id]?.[0];
              const displayImage = recipeCover?.thumbnailUrl;
              return (
                <motion.div 
                  layout
                  key={recipe.id} 
                  onClick={() => {
                    setSelectedRecipeId(recipe.id);
                    setDetailRecipe(recipe);
                  }}
                  className="glass-card rounded-3xl overflow-hidden group cursor-pointer transition-all border-2 border-transparent hover:border-blue-500/30 flex flex-col"
                >
                  {/* Card Image Preview */}
                  <div className="h-48 w-full relative overflow-hidden bg-slate-500/10">
                    {displayImage ? (
                      <img 
                        src={displayImage} 
                        alt="" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-8 h-8 text-slate-500/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                    <div className="absolute bottom-4 left-6">
                      <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">{recipe.filmMode}</p>
                    </div>
                  </div>

                  <div className="p-8 space-y-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-xl tracking-tight">{recipe.name}</h3>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2">
                      <FilmTag label="WB" value={`${recipe.whiteBalance} ${recipe.whiteBalanceShift || ''}`} className="col-span-2" />
                      <FilmTag label="DR" value={recipe.dynamicRange} />
                      <FilmTag label="CLR" value={recipe.saturation} />
                      <FilmTag label="TONE" value={`H${recipe.highlightTone} S${recipe.shadowTone}`} className="col-span-2" />
                      <FilmTag label="GRAIN" value={recipe.grainEffect?.replace(', ', ' ') || 'Off'} className="col-span-2" />
                      <FilmTag label="CHROME" value={`C${recipe.colorChromeEffect?.charAt(0)} B${recipe.colorChromeEffectBlue?.charAt(0)}`} className="col-span-2" />
                      <FilmTag label="DETAIL" value={`S${recipe.sharpness} N${recipe.noiseReduction} C${recipe.clarity}`} className="col-span-2" />
                    </div>

                    <div className="mt-auto pt-6 border-t border-[var(--border-color)] flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {(recipePhotosMap[recipe.id] || []).length} {t('recipe.photos')}
                      </span>
                      <div className="flex items-center gap-2 text-blue-500">
                        <span className="text-[10px] font-black uppercase tracking-widest">{t('recipe.details')}</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
        </div>
        </div>

        {/* Recipe Details Panel - Full Screen Overlay */}
        <AnimatePresence>
          {selectedRecipeId && selectedRecipe && (() => {
            // Parse WB Shift
            const wbShift = selectedRecipe.whiteBalanceShift ? selectedRecipe.whiteBalanceShift.split(',').map(s => s.trim()) : [];
            const wbRed = wbShift[0] || '0';
            const wbBlue = wbShift[1] || '0';

            // Parse Grain Effect
            const grainParts = selectedRecipe.grainEffect ? selectedRecipe.grainEffect.split(',').map(s => s.trim()) : [];
            const grainRoughness = grainParts[0] || 'Off';
            const grainSize = grainParts[1] || 'Off';

            const allImages = recipePhotos.map(p => p.thumbnailUrl);

            return (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="absolute inset-0 z-10 h-full overflow-y-auto custom-scrollbar"
              >
                <div className="glass-card rounded-[2.5rem] p-5 space-y-3 min-h-full">
                  <div className="flex items-center justify-between">
                    <button 
                      onClick={() => {
                        setSelectedRecipeId(null);
                        setDetailRecipe(null);
                      }}
                      className="flex items-center gap-3 text-slate-400 hover:text-blue-500 transition-colors group"
                    >
                      <div className="p-2 bg-slate-500/5 rounded-xl group-hover:bg-blue-500/10 transition-all">
                        <ChevronLeft className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">{t('recipe.backToList')}</span>
                    </button>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setEditingRecipe(selectedRecipe)}
                        className="p-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl transition-all border border-[var(--border-color)]"
                      >
                        <Edit3 className="w-5 h-5 text-slate-400" />
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(selectedRecipe.id)}
                        className="p-4 bg-slate-500/5 hover:bg-red-500/10 rounded-2xl transition-all border border-[var(--border-color)] hover:border-red-500/20"
                      >
                        <Trash2 className="w-5 h-5 text-slate-400 hover:text-red-500" />
                      </button>
                      <button className="p-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl transition-all border border-[var(--border-color)]">
                        <Share2 className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>
                  </div>

                  {/* Carousel Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-7 space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 whitespace-nowrap bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105"
                          >
                            <div className="w-1 h-1 rounded-full bg-white" />
                            {activeAspectOption.label}
                          </button>
                          <button
                            onClick={() => setAspectOptionsExpanded((v) => !v)}
                            className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 whitespace-nowrap bg-slate-500/5 border-[var(--border-color)] text-slate-400 hover:border-blue-500/30 hover:bg-slate-500/10"
                          >
                            其他比例
                            <ChevronDown className={cn("w-3 h-3 transition-transform", aspectOptionsExpanded && "rotate-180")} />
                          </button>
                        </div>
                        {aspectOptionsExpanded && (
                          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar-hide">
                            {CAROUSEL_ASPECT_OPTIONS.filter((opt) => opt.key !== selectedAspectKey).map((opt) => (
                              <button
                                key={opt.key}
                                onClick={() => {
                                  setSelectedAspectKey(opt.key);
                                  setAspectManuallyChanged(true);
                                  setAspectOptionsExpanded(false);
                                }}
                                className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 whitespace-nowrap bg-slate-500/5 border-[var(--border-color)] text-slate-400 hover:border-blue-500/30 hover:bg-slate-500/10"
                              >
                                <div className="w-1 h-1 rounded-full bg-slate-400" />
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {allImages.length > 0 ? (
                        <div className={cn("relative rounded-[2.5rem] overflow-hidden group/carousel shadow-2xl", activeAspectOption.className)}>
                          <div 
                            ref={carouselRef}
                            className="flex h-full overflow-x-auto snap-x snap-mandatory custom-scrollbar-hide"
                          >
                            {allImages.map((img, i) => (
                              <div key={i} className="flex-none w-full h-full snap-center">
                                <img 
                                  src={img} 
                                  alt="" 
                                  className="w-full h-full object-cover" 
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ))}
                          </div>
                          
                          {/* Carousel Indicators */}
                          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                            {allImages.map((_, i) => (
                              <div key={i} className="w-2 h-2 rounded-full bg-white/30 backdrop-blur-md" />
                            ))}
                          </div>
                          
                          {/* Navigation Overlay */}
                          <div className="absolute inset-0 flex items-center justify-between px-8 opacity-0 group-hover/carousel:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { e.stopPropagation(); scrollCarousel('left'); }}
                              className="p-4 bg-black/20 backdrop-blur-xl text-white rounded-full hover:bg-black/40 transition-all border border-white/10"
                            >
                              <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); scrollCarousel('right'); }}
                              className="p-4 bg-black/20 backdrop-blur-xl text-white rounded-full hover:bg-black/40 transition-all border border-white/10"
                            >
                              <ChevronRight className="w-6 h-6" />
                            </button>
                          </div>

                          <button 
                            className="absolute top-6 right-6 p-4 bg-white/10 backdrop-blur-xl text-white rounded-2xl hover:bg-white/20 transition-all border border-white/10 flex items-center gap-2"
                            onClick={() => handleAddPhotosToRecipe(selectedRecipe.id)}
                          >
                            <Plus className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{t('recipe.addPhoto')}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="h-[500px] rounded-[2.5rem] bg-slate-500/5 border-2 border-dashed border-[var(--border-color)] flex flex-col items-center justify-center space-y-4">
                          <div className="w-20 h-20 bg-slate-500/10 rounded-3xl flex items-center justify-center">
                            <ImageIcon className="w-10 h-10 text-slate-400" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-slate-400">{t('recipe.noPhotosForRecipe')}</p>
                            <button 
                              className="mt-4 text-blue-500 text-[10px] font-black uppercase tracking-widest hover:underline"
                              onClick={() => handleAddPhotosToRecipe(selectedRecipe.id)}
                            >
                              {t('recipe.uploadFirstPhoto')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-5 space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                            <Film className="w-8 h-8 text-blue-500" />
                          </div>
                          <div>
                            <h2 className="text-3xl font-black tracking-tight">{selectedRecipe.name}</h2>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="px-4 py-1.5 bg-blue-500/10 text-blue-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                                {selectedRecipe.filmMode}
                              </span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('recipe.createdByYou')}</span>
                            </div>
                          </div>
                        </div>
                        {selectedRecipe.description && (
                          <p className="text-slate-400 font-medium leading-relaxed text-sm">{selectedRecipe.description}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: t('recipe.whiteBalance'), value: selectedRecipe.whiteBalance },
                          { label: t('recipe.dynamicRange'), value: selectedRecipe.dynamicRange },
                          { label: t('recipe.highlight'), value: selectedRecipe.highlightTone },
                          { label: t('recipe.shadow'), value: selectedRecipe.shadowTone },
                          { label: t('recipe.color'), value: selectedRecipe.saturation },
                          { label: t('recipe.sharpness'), value: selectedRecipe.sharpness },
                          { label: t('recipe.noiseReduction'), value: selectedRecipe.noiseReduction },
                          { label: t('recipe.clarity'), value: selectedRecipe.clarity },
                          { label: t('recipe.grainRoughness'), value: grainRoughness },
                          { label: t('recipe.grainSize'), value: grainSize },
                          { label: t('recipe.colorChrome'), value: selectedRecipe.colorChromeEffect },
                          { label: t('recipe.fxBlue'), value: selectedRecipe.colorChromeEffectBlue },
                          { label: t('recipe.wbRed'), value: wbRed },
                          { label: t('recipe.wbBlue'), value: wbBlue },
                        ].map(stat => (
                          <FilmSettingCard key={stat.label} label={stat.label} value={stat.value} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black tracking-tight">{t('recipe.communityPhotos')}</h3>
                      <button className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline">{t('recipe.exploreMore')}</button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar-hide">
                      {recipePhotos.map(photo => (
                        <div key={photo.id} className="flex-none w-28 h-28 rounded-xl overflow-hidden bg-slate-500/10 group relative shadow-lg">
                          <img src={photo.thumbnailUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePhotoFromRecipe(selectedRecipe.id, photo.id);
                            }}
                            className="absolute top-1.5 right-1.5 p-1.5 bg-black/45 hover:bg-red-500/80 text-white rounded-md border border-white/20 opacity-0 group-hover:opacity-100 transition-all"
                            title={t('recipe.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button 
                        className="flex-none w-28 h-28 rounded-xl border-2 border-dashed border-[var(--border-color)] flex flex-col items-center justify-center space-y-1 hover:bg-slate-500/5 transition-all group"
                        onClick={() => handleAddPhotosToRecipe(selectedRecipe.id)}
                      >
                        <Plus className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('recipe.addPhoto')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
                <h2 className="text-2xl font-black tracking-tight">{t('recipe.newRecipe')}</h2>
                <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              {renderRecipeForm(newRecipe, setNewRecipe, handleCreate, t('recipe.createRecipe'))}
              <div className="p-8 border-t border-[var(--border-color)] flex-shrink-0">
                <button 
                  onClick={handleCreate}
                  disabled={!newRecipe.name}
                  className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('recipe.createRecipe')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingRecipe && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
                <h2 className="text-2xl font-black tracking-tight">{t('recipe.editRecipe')}</h2>
                <button onClick={() => setEditingRecipe(null)} className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              {renderRecipeForm(editingRecipe, (r) => setEditingRecipe(prev => prev ? { ...prev, ...r } : null), handleUpdate, t('recipe.saveChanges'))}
              <div className="p-8 border-t border-[var(--border-color)] flex-shrink-0">
                <button 
                  onClick={handleUpdate}
                  disabled={!editingRecipe.name}
                  className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('recipe.saveChanges')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showDeleteConfirm && (
          <ConfirmModal 
            title={t('recipe.deleteRecipe')}
            message={t('recipe.deleteConfirm')}
            confirmLabel={t('recipe.delete')}
            onConfirm={() => handleDelete(showDeleteConfirm)}
            onCancel={() => setShowDeleteConfirm(null)}
            variant="danger"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Slider({ 
  value, 
  onChange, 
  min = -4, 
  max = 4, 
  step = 1,
  label
}: { 
  value: number, 
  onChange: (val: number) => void, 
  min?: number, 
  max?: number, 
  step?: number,
  label?: string
}) {
  return (
    <div className="space-y-4 p-6 bg-slate-500/5 rounded-2xl border border-[var(--border-color)]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        <span className={cn(
          "text-sm font-black px-3 py-1 rounded-lg",
          value > 0 ? "bg-blue-500/10 text-blue-500" : value < 0 ? "bg-red-500/10 text-red-500" : "bg-slate-500/10 text-slate-500"
        )}>
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-500/10 rounded-full appearance-none cursor-pointer accent-blue-500"
      />
      <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
        <span>{min}</span>
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Switch({ 
  checked, 
  onChange, 
  label 
}: { 
  checked: boolean, 
  onChange: (val: boolean) => void, 
  label: string 
}) {
  return (
    <div className="flex items-center justify-between p-6 bg-slate-500/5 rounded-2xl border border-[var(--border-color)]">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none",
          checked ? "bg-blue-500" : "bg-slate-500/20"
        )}
      >
        <motion.div
          animate={{ x: checked ? 26 : 4 }}
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}
