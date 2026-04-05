import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Share2, Trash2, Star, Sparkles, HardDrive, ExternalLink } from 'lucide-react';
import { Photo, Recipe, Tag, Folder } from '../../types';
import { FILM_SHORT_CODES } from '../../constants/filmModes';
import { ConfirmModal } from './ConfirmModal';
import { CustomSelect } from '../common/CustomSelect';
import { CompactExif } from '../common/CompactExif';
import { FilmTag } from '../common/FilmTag';

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
        color: '#3b82f6',
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
            <img src={photo.thumbnailUrl} className="max-w-full max-h-full object-contain" alt={photo.fileName} />
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
                        <Sparkles className="w-5 h-5" />
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
                    <CompactExif icon={<HardDrive className="w-3 h-3" />} value={photo.cameraModel} />
                    <CompactExif icon={<ExternalLink className="w-3 h-3" />} value={photo.fNumber} />
                    <CompactExif icon={<Star className="w-3 h-3" />} value={photo.exposureTime} />
                    <CompactExif icon={<Share2 className="w-3 h-3" />} value={photo.iso?.toString()} />
                    <CompactExif icon={<ExternalLink className="w-3 h-3" />} value={photo.focalLength} />
                    <CompactExif icon={<Sparkles className="w-3 h-3" />} value={photo.lensModel} />
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
                      className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-500/20"
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
                  <HardDrive className="w-5 h-5" />
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