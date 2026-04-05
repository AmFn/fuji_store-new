import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Trash2 } from 'lucide-react';
import { Photo } from '../../types';
import { ThumbImage } from './ThumbImage';
import { ConfirmModal } from '../modals/ConfirmModal';
import { FILM_SHORT_CODES } from '../../constants/filmModes';
import { cn } from '../../lib/utils';

interface PhotoCardProps {
  photo: Photo;
  mode: 'grid' | 'list';
  onClick: () => void;
  theme: string;
  onToggleFavorite: (id: string) => void;
  onDeletePhoto: (id: string) => void;
}

export const PhotoCard = React.memo(({ photo, mode, onClick, theme, onToggleFavorite, onDeletePhoto }: PhotoCardProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('photoId', photo.id);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(photo.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    onDeletePhoto(photo.id);
    setShowDeleteConfirm(false);
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
              <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-500 px-2 py-1 rounded-md">{photo.cameraModel}</span>
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

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <ConfirmModal 
              title="删除照片"
              message={`确定要删除 "${photo.fileName}" 吗？此操作无法撤销。`}
              confirmLabel="删除"
              onConfirm={handleDeleteConfirm}
              onCancel={() => setShowDeleteConfirm(false)}
              variant="danger"
            />
          )}
        </AnimatePresence>
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
        <div className="p-4 flex flex-col items-start gap-2 h-24">
          <div className="w-full flex items-center justify-between gap-4">
            <h3 className="font-bold text-sm truncate text-slate-600 dark:text-slate-300">{photo.fileName}</h3>
            <button 
              onClick={handleDelete}
              className="p-2 hover:bg-red-500/10 rounded-xl transition-all group/delete"
            >
              <Trash2 className="w-4 h-4 text-slate-300 group-hover/delete:text-red-500 transition-all" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <ConfirmModal 
            title="删除照片"
            message={`确定要删除 "${photo.fileName}" 吗？此操作无法撤销。`}
            confirmLabel="删除"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setShowDeleteConfirm(false)}
            variant="danger"
          />
        )}
      </AnimatePresence>
    </div>
  );
});
