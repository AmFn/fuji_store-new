import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Search, Trash2, Check, Tags } from 'lucide-react';
import { Tag, Photo } from '../../types';
import { COLORS } from '../../constants/filmModes';
import { cn } from '../../lib/utils';
import { ConfirmModal } from '../modals/ConfirmModal';
import { tagService } from '../../services/tagService';

interface TagsViewProps {
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  photos: Photo[];
  setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
  onTagClick: (tagName: string) => void;
}

function TagCard({ tag, photos, index, onClick, onDelete }: { tag: Tag, photos: Photo[], index: number, onClick: () => void, onDelete: (e: React.MouseEvent) => void }) {
  const [isHovered, setIsHovered] = useState(false);
  console.log('[TagCard] tag:', tag.name, 'total photos:', photos.length);
  photos.slice(0, 3).forEach(p => {
    console.log('[TagCard] Photo:', p.fileName, 'tags:', JSON.stringify(p.tags), 'includes tag?', p.tags?.includes(tag.name));
  });
  const tagPhotos = photos.filter(p => p.tags?.includes(tag.name));
  console.log('[TagCard] tagPhotos for', tag.name, ':', tagPhotos.length);
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
              <img src={photo.thumbnailUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
            </motion.div>
          ))
        ) : (
          <div className="absolute inset-0 rounded-3xl bg-slate-500/5 border-4 border-dashed border-slate-500/20 flex items-center justify-center">
            <Tags className="w-12 h-12 text-slate-500/20" />
          </div>
        )}
        
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

export function TagsView({ tags, setTags, photos, setPhotos, onTagClick }: TagsViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ show: boolean, tagId: string, tagName: string }>({ show: false, tagId: '', tagName: '' });

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    console.log('[TagsView] Creating tag:', newTagName.trim());
    
    const existingTag = tags.find(t => t.name.toLowerCase() === newTagName.trim().toLowerCase());
    if (existingTag) {
      console.log('[TagsView] Tag already exists:', existingTag);
      setNewTagName('');
      setIsCreating(false);
      return;
    }
    
    const tag = await tagService.createTag({ 
      name: newTagName.trim(), 
      color: newTagColor,
      ownerId: 'local'
    });
    console.log('[TagsView] createTag result:', tag);
    if (tag) {
      setTags(prev => {
        if (prev.some(t => t.name.toLowerCase() === tag.name.toLowerCase())) {
          return prev;
        }
        return [...prev, tag];
      });
      setNewTagName('');
      setIsCreating(false);
    }
  };

  const handleDeleteTag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tagToDelete = tags.find(t => t.id === id);
    if (!tagToDelete) return;
    setShowDeleteConfirm({ show: true, tagId: id, tagName: tagToDelete.name });
  };

  const handleDeleteTagConfirm = async () => {
    const { tagId, tagName } = showDeleteConfirm;
    console.log('[TagsView] Deleting tag:', tagId);
    await tagService.deleteTag(tagId);
    setTags(prev => prev.filter(t => t.id !== tagId));
    setPhotos(prev => prev.map(p => ({
      ...p,
      tags: p.tags?.filter(t => t !== tagName) || []
    })));
    setShowDeleteConfirm({ show: false, tagId: '', tagName: '' });
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

        {showDeleteConfirm.show && (
          <ConfirmModal 
            title="Delete Tag"
            message={`Are you sure you want to delete "${showDeleteConfirm.tagName}"? This will remove it from all photos.`}
            confirmLabel="Delete"
            onConfirm={handleDeleteTagConfirm}
            onCancel={() => setShowDeleteConfirm({ show: false, tagId: '', tagName: '' })}
            variant="danger"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
