import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HardDrive, Folder, RefreshCw, Plane, Edit2, Plus, FolderPlus, Trash2 } from 'lucide-react';
import { Folder as FolderType, Photo } from '../../types';
import { ContextMenuItem } from './ContextMenuItem';
import { cn } from '../../lib/utils';
import { isPhotoInFolder } from '../../utils/fileUtils';

interface DirectoryTreeProps {
  folders: FolderType[];
  onRefresh: (id: string) => void;
  photos: Photo[];
  activeFolderId: string | null;
  onFolderSelect: (id: string | null) => void;
  onRename: (id: string) => void;
  onAddSubfolder: (id: string) => void;
  onAddFiles: (id: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onUpdatePhoto: (id: string, updates: Partial<Photo>) => void;
  onOpenFolderPath: (folderPath: string) => void | Promise<void>;
  onDeleteFolder: (id: string) => void | Promise<void>;
  onClearPhotos: (id: string) => void;
  onDeleteFolderConfirm: (id: string) => void;
}

export function DirectoryTree({ 
  folders, 
  onRefresh, 
  photos, 
  activeFolderId, 
  onFolderSelect, 
  onRename, 
  onAddSubfolder, 
  onAddFiles, 
  onReorder, 
  onUpdatePhoto, 
  onOpenFolderPath, 
  onDeleteFolder, 
  onClearPhotos, 
  onDeleteFolderConfirm 
}: DirectoryTreeProps) {
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
                  <Folder className={cn("w-4 h-4 transition-colors", (dragOverId === node.id || isActive) ? "text-blue-500" : "opacity-50")} />
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
            <ContextMenuItem icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />} label="清空所有照片" onClick={() => { 
              onClearPhotos(contextMenu.folderId);
              setContextMenu(null);
            }} danger onClose={() => setContextMenu(null)} />
            <ContextMenuItem icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />} label="Delete" onClick={() => { 
              onDeleteFolderConfirm(contextMenu.folderId);
              setContextMenu(null);
            }} danger onClose={() => setContextMenu(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

