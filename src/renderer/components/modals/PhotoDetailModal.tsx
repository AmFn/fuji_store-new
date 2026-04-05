import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Share2, Trash2, Star, Sparkles, HardDrive, ExternalLink, Navigation, FlaskConical } from 'lucide-react';
import { Photo, Recipe, Tag, Folder } from '../../types';
import { ConfirmModal } from './ConfirmModal';
import { CustomSelect } from '../common/CustomSelect';
import { CompactExif } from '../common/CompactExif';
import { FilmTag } from '../common/FilmTag';
import { FilmSettingCard } from '../common/FilmSettingCard';
import { tagService } from '../../services/tagService';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../hooks/useLanguage';

interface PhotoDetailModalProps {
  photo: Photo;
  onClose: () => void;
  recipes: Recipe[];
  folders: Folder[];
  onRecognize: (p: Photo) => void;
  theme: string;
  allTags: Tag[];
  onExport: () => void;
  onUpdatePhoto: (id: string, updates: Partial<Photo>) => void;
  onDeletePhoto: (id: string) => void;
  onAddTag: (tag: Tag) => void;
}

export function PhotoDetailModal({
  photo,
  onClose,
  recipes,
  folders,
  onRecognize,
  theme,
  allTags,
  onExport,
  onUpdatePhoto,
  onDeletePhoto,
  onAddTag
}: PhotoDetailModalProps) {
  const { t } = useLanguage();
  const [isFavorite, setIsFavorite] = useState(photo.isFavorite);
  const [isHidden, setIsHidden] = useState(photo.isHidden);
  const [rating, setRating] = useState(photo.rating);
  const [photoTags, setPhotoTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState(photo.recipeId || '');

  useEffect(() => {
    const loadTags = async () => {
      if (photo.id) {
        console.log('[PhotoDetailModal] Loading tags for photo:', photo.id, typeof photo.id);
        try {
          const tags = await tagService.getTagsByPhoto(photo.id);
          console.log('[PhotoDetailModal] Loaded tags:', tags);
          setPhotoTags(tags);
        } catch (err) {
          console.error('[PhotoDetailModal] Failed to load tags:', err);
        }
      }
    };
    loadTags();
  }, [photo.id]);

  const folder = folders.find(f => f.id === photo.folderId);
  const currentRecipe = recipes.find(r => r.id === selectedRecipeId);

  const suggestions = allTags
    .filter(t => t.name.toLowerCase().includes(newTag.toLowerCase()))
    .filter(t => !photoTags.some(pt => pt.name === t.name))
    .slice(0, 5);

  const wbShift = photo.whiteBalanceShift?.split(',').map(s => s.trim()) || [];
  const wbRed = wbShift[0] || '0';
  const wbBlue = wbShift[1] || '0';

  const grainParts = photo.grainEffect?.split(',').map(s => s.trim()) || [];
  const grainRoughness = grainParts[0] || 'Off';
  const grainSize = grainParts[1] || 'Off';

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
    console.log('[PhotoDetailModal] handleAddTag called with:', tagName);
    const cleanTag = tagName.trim();
    if (!cleanTag) {
      console.log('[PhotoDetailModal] Empty tag, returning');
      return;
    }
    
    const existingTag = photoTags.find(t => t.name.toLowerCase() === cleanTag.toLowerCase());
    if (existingTag) {
      console.log('[PhotoDetailModal] Tag already exists:', existingTag);
      return;
    }

    setNewTag('');
    
    console.log('[PhotoDetailModal] Calling getOrCreateTag for:', cleanTag);
    const tag = await tagService.getOrCreateTag(cleanTag, photo.ownerId);
    console.log('[PhotoDetailModal] getOrCreateTag returned:', tag);
    
    if (tag) {
      console.log('[PhotoDetailModal] Adding tag to photo:', { photoId: photo.id, tagId: tag.id });
      await tagService.addTagToPhoto(photo.id, tag.id);
      setPhotoTags([...photoTags, tag]);
      
      const newTags = [...(photo.tags || []), tag.name];
      onUpdatePhoto(photo.id, { tags: newTags });
      
      if (!allTags.some(t => t.name === cleanTag)) {
        onAddTag(tag);
      }
    }
  };

  const handleRemoveTag = async (tagToRemove: Tag) => {
    await tagService.removeTagFromPhoto(photo.id, tagToRemove.id);
    setPhotoTags(photoTags.filter(t => t.id !== tagToRemove.id));
    
    const newTags = (photo.tags || []).filter(t => t !== tagToRemove.name);
    onUpdatePhoto(photo.id, { tags: newTags });
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
          <div className="flex-1 bg-black/20 flex items-center justify-center relative group">
            <img src={photo.previewUrl} className="max-w-full max-h-full object-contain" alt={photo.fileName} />
            {photo.fileName.toLowerCase().endsWith('.raf') && (
              <div className="absolute top-8 right-8 px-4 py-2 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                {t('photoDetail.rawFile')}
              </div>
            )}
            <button 
              onClick={onClose}
              className="absolute top-8 left-8 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-2xl transition-all border border-white/20 text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="w-full lg:w-[28rem] flex flex-col bg-[var(--bg-primary)]/50 backdrop-blur-2xl border-l border-[var(--border-color)]">
            <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-black tracking-tight truncate">{photo.fileName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(photo.dateTime || '').toLocaleString()}</p>
                  <span className="text-slate-600">•</span>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                    <HardDrive className="w-3 h-3" />
                    {folder?.name || t('photoDetail.uncategorized')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={onExport}
                  className="p-2.5 bg-slate-500/5 hover:bg-orange-500/10 text-slate-400 hover:text-orange-500 rounded-xl transition-all border border-transparent hover:border-orange-500/20"
                  title={t('photoDetail.exportRecipe')}
                >
                  <Share2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2.5 bg-slate-500/5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                  title={t('photoDetail.deletePhoto')}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1 bg-slate-500/5 p-1.5 rounded-xl border border-[var(--border-color)]">
                  {[1, 2, 3, 4, 5].map(r => (
                    <button key={r} onClick={() => handleRating(r)} className="p-1">
                      <Star className={r <= rating ? "w-4 h-4 text-yellow-500 fill-yellow-500" : "w-4 h-4 text-slate-300 hover:text-yellow-500/50"} />
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleToggleFavorite}
                    className={isFavorite ? "p-2 rounded-lg transition-all border bg-red-500/10 text-red-500 border-red-500/20" : "p-2 rounded-lg transition-all border bg-white/5 text-slate-400 border-transparent hover:text-red-500"}
                  >
                    <Heart className={isFavorite ? "w-4 h-4 fill-red-500" : "w-4 h-4"} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t('photoDetail.associatedRecipe')}</h3>
                  {currentRecipe && (
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-full">{t('photoDetail.active')}</span>
                  )}
                </div>
                <div className="space-y-3">
                  <CustomSelect 
                    value={selectedRecipeId}
                    onChange={handleRecipeChange}
                    placeholder={t('photoDetail.selectRecipe')}
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

              <button 
                onClick={() => onRecognize(photo)}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Sparkles className="w-4 h-4" />
                {t('photoDetail.aiRecognition')}
              </button>

              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t('photoDetail.exifMetadata')}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <CompactExif icon={<HardDrive className="w-3 h-3" />} value={photo.cameraModel} />
                    <CompactExif icon={<ExternalLink className="w-3 h-3" />} value={photo.fNumber} />
                    <CompactExif icon={<Star className="w-3 h-3" />} value={photo.exposureTime} />
                    <CompactExif icon={<Share2 className="w-3 h-3" />} value={photo.iso?.toString()} />
                    <CompactExif icon={<ExternalLink className="w-3 h-3" />} value={photo.focalLength} />
                    <CompactExif icon={<Sparkles className="w-3 h-3" />} value={photo.lensModel} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t('photoDetail.filmSettings')}</h3>
                    <div className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-[8px] font-black uppercase tracking-widest border border-blue-500/20">
                      {photo.filmMode || 'Provia'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FilmSettingCard label={t('recipe.whiteBalance')} value={photo.whiteBalance} />
                    <FilmSettingCard label={t('recipe.dynamicRange')} value={photo.dynamicRange} />
                    <FilmSettingCard label={t('recipe.highlight')} value={photo.highlightTone} />
                    <FilmSettingCard label={t('recipe.shadow')} value={photo.shadowTone} />
                    <FilmSettingCard label={t('recipe.color')} value={photo.saturation} />
                    <FilmSettingCard label={t('recipe.sharpness')} value={photo.sharpness} />
                    <FilmSettingCard label={t('recipe.noiseReduction')} value={photo.noiseReduction} />
                    <FilmSettingCard label={t('recipe.clarity')} value={photo.clarity} />
                    <FilmSettingCard label={t('recipe.grainRoughness')} value={grainRoughness} />
                    <FilmSettingCard label={t('recipe.grainSize')} value={grainSize} />
                    <FilmSettingCard label={t('recipe.colorChrome')} value={photo.colorChromeEffect} />
                    <FilmSettingCard label={t('recipe.fxBlue')} value={photo.colorChromeEffectBlue} />
                    <FilmSettingCard label={t('recipe.wbRed')} value={wbRed} />
                    <FilmSettingCard label={t('recipe.wbBlue')} value={wbBlue} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-[var(--border-color)]">
                <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t('photoDetail.tags')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {photoTags.map(tag => (
                    <span 
                      key={tag.id} 
                      className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-500/20 group/tag"
                      style={{ borderColor: tag.color ? `${tag.color}33` : undefined, color: tag.color || undefined }}
                    >
                      {tag.name}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 transition-colors">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="+"
                      className="w-12 bg-slate-500/5 border border-[var(--border-color)] rounded-lg px-2 py-1 text-[9px] font-bold focus:outline-none focus:w-24 transition-all"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        console.log('[PhotoDetailModal] Key pressed:', e.key, 'value:', newTag);
                        if (e.key === 'Enter') {
                          console.log('[PhotoDetailModal] Enter pressed, calling handleAddTag');
                          handleAddTag(newTag);
                        }
                      }}
                    />
                    {newTag && suggestions.length > 0 && (
                      <div className="absolute bottom-full mb-2 left-0 w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-10">
                        {suggestions.map(tag => (
                          <button
                            key={tag.id}
                            onClick={() => handleAddTag(tag.name)}
                            className="w-full px-4 py-2 text-left text-[10px] font-bold hover:bg-blue-500/10 hover:text-blue-500 transition-colors flex items-center gap-2"
                          >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {!newTag && allTags.length > 0 && allTags.some(t => !photoTags.some(pt => pt.name === t.name)) && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest w-full mb-1">{t('photoDetail.availableTags')}</span>
                    {allTags.filter(t => !photoTags.some(pt => pt.name === t.name)).slice(0, 10).map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => handleAddTag(tag.name)}
                        className="px-2 py-1 bg-slate-500/5 hover:bg-slate-500/10 text-slate-400 hover:text-blue-500 rounded-lg text-[8px] font-black uppercase tracking-widest border border-transparent hover:border-blue-500/20 transition-all"
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 border-t border-[var(--border-color)] flex flex-col gap-4">
              <div className="flex gap-4">
                <button 
                  onClick={() => console.log('Locating file:', photo.filePath)}
                  className="flex-1 py-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 border border-[var(--border-color)]"
                >
                  <Navigation className="w-5 h-5" />
                  {t('photoDetail.locateFile')}
                </button>
                <button 
                  onClick={() => console.log('Opening original:', photo.filePath)}
                  className="flex-1 py-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 border border-[var(--border-color)]"
                >
                  <ExternalLink className="w-5 h-5" />
                  {t('photoDetail.openOriginal')}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <ConfirmModal 
            title={t('photoDetail.deleteConfirmTitle')}
            message={t('photoDetail.deleteConfirmMessage')}
            confirmLabel={t('recipe.delete')}
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
            variant="danger"
          />
        )}
      </AnimatePresence>
    </>
  );
}
