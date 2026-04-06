import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HardDrive, Folder, RefreshCw, Plane, Edit2, Plus, FolderPlus, Trash2, Info } from 'lucide-react';
import { Folder as FolderType, Photo } from '../../types';
import { ContextMenuItem } from './ContextMenuItem';
import { cn } from '../../lib/utils';
import { isPhotoInFolder } from '../../utils/fileUtils';
import { useLanguage } from '../../hooks/useLanguage';

const ROOT_PARENT_ID = '-1';

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
  onShowFolderInfo: (folder: { name: string; path: string }) => void;
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
  onDeleteFolderConfirm,
  onShowFolderInfo 
}: DirectoryTreeProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: string } | null>(null);

  useEffect(() => {
    if (folders.length > 0) {
      const allFolderIds = new Set(folders.map(f => f.id));
      setExpanded(allFolderIds);
    }
  }, [folders]);

  // 构建树状结构
  const folderTree = useMemo(() => {
    const orderedFolders = [...folders].sort((a, b) => {
      const parentA = a.parentId || ROOT_PARENT_ID;
      const parentB = b.parentId || ROOT_PARENT_ID;
      if (parentA !== parentB) return parentA.localeCompare(parentB);
      const sortA = Number(a.sortOrder ?? 0);
      const sortB = Number(b.sortOrder ?? 0);
      if (sortA !== sortB) return sortA - sortB;
      return a.id.localeCompare(b.id);
    });

    const folderMap = new Map<string, FolderType>();
    const tree: FolderType[] = [];

    // 首先将所有文件夹放入map
    orderedFolders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // 然后构建树状结构
    folderMap.forEach(folder => {
      if (!folder.parentId || folder.parentId === '0' || folder.parentId === ROOT_PARENT_ID) {
        // 根文件夹（parentId为-1/0/空）
        tree.push(folder);
      } else {
        // 子文件夹
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          parent.children = [...(parent.children || []), folder];
        }
      }
    });

    return tree;
  }, [folders]);

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

  // 递归渲染文件夹
  const renderFolder = (folder: FolderType, level: number = 0) => {
    const photoCount = photos.filter(p => isPhotoInFolder(p, folder)).length;
    const isActive = activeFolderId === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.id} className="space-y-1">
        <div 
          className="space-y-1"
          draggable
          onDragStart={(e) => handleFolderDragStart(e, folder.id)}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.id)}
          onContextMenu={(e) => handleContextMenu(e, folder.id)}
        >
          <div className={cn(
            "flex items-center group rounded-xl transition-all",
            dragOverId === folder.id ? "bg-blue-500/20 scale-[1.02]" : "hover:bg-slate-500/5",
            isActive && "bg-blue-500/10"
          )}>
            {hasChildren && (
              <button 
                onClick={() => toggle(folder.id)}
                className="p-1.5 hover:bg-slate-500/10 rounded-md transition-colors"
              >
                <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", !expanded.has(folder.id) && "-rotate-90")} />
              </button>
            )}
            {!hasChildren && (
              <div className="w-8"></div>
            )}
            <button 
              onClick={() => onFolderSelect(isActive ? null : folder.id)}
              className={cn(
                "flex-1 px-2 py-2 rounded-lg flex items-center gap-3 text-xs font-bold transition-all truncate",
                isActive ? "text-blue-500" : "text-slate-400 hover:text-blue-500"
              )}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
            >
              {folder.type === 'physical' ? (
                <HardDrive className={cn("w-4 h-4 transition-colors", (dragOverId === folder.id || isActive) ? "text-blue-500" : "opacity-50")} />
              ) : (
                <Folder className={cn("w-4 h-4 transition-colors", (dragOverId === folder.id || isActive) ? "text-blue-500" : "opacity-50")} />
              )}
              <span className="truncate flex-1 text-left">{folder.name}</span>
            </button>
            
            <span className="text-[10px] opacity-40 font-black bg-slate-500/10 px-2 py-0.5 rounded-full ml-2">{photoCount || folder.photoCount}</span>
          </div>
        </div>

        {/* 渲染子文件夹 */}
        {hasChildren && expanded.has(folder.id) && (
          <div className="pl-4">
            {folder.children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(null);
    const draggedFolderId = e.dataTransfer.getData('folderId');
    if (draggedFolderId) {
      onReorder(draggedFolderId, ROOT_PARENT_ID);
    }
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // 设置根目录区域的拖放状态，用于视觉反馈
    setDragOverId('root');
  };

  return (
    <div 
      className="relative max-h-[calc(100vh-12rem)] overflow-y-auto pr-2" 
      onClick={() => setContextMenu(null)}
      onDragOver={handleRootDragOver}
      onDrop={handleRootDrop}
      onDragLeave={handleDragLeave}
    >
      <div className="space-y-1">
        {folderTree.map(folder => renderFolder(folder))}
        
        {/* 下方空白区域作为根目录拖放目标 */}
        <div 
          className="h-16 flex items-center justify-center"
          onDragOver={handleRootDragOver}
          onDrop={handleRootDrop}
          onDragLeave={handleDragLeave}
        />
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            {/* 检查是否是未分类目录 */}
            {(() => {
              const currentFolder = folders.find(f => f.id === contextMenu.folderId);
              const isUncategorized = currentFolder?.name === '未分类';
              
              return (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                  className="fixed z-[100] w-48 glass-card rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden p-1.5"
                >
                  {/* 未分类目录不需要重命名和删除选项 */}
                  {!isUncategorized && (
                    <ContextMenuItem icon={<Edit2 className="w-3.5 h-3.5" />} label={t('folder.rename')} onClick={() => onRename(contextMenu.folderId)} onClose={() => setContextMenu(null)} />
                  )}
                  <ContextMenuItem icon={<Plus className="w-3.5 h-3.5" />} label={t('folder.addPhotos')} onClick={() => onAddFiles(contextMenu.folderId)} onClose={() => setContextMenu(null)} />
                  <ContextMenuItem icon={<FolderPlus className="w-3.5 h-3.5" />} label={t('folder.newSubfolder')} onClick={() => onAddSubfolder(contextMenu.folderId)} onClose={() => setContextMenu(null)} />
                  
                  {/* 为物理文件夹添加额外的操作选项 */}
                  {currentFolder?.type === 'physical' && (
                    <>
                      <div className="h-px bg-[var(--border-color)] my-1.5 mx-2" />
                      <ContextMenuItem icon={<Info className="w-3.5 h-3.5" />} label="Info" onClick={() => {
                        if (currentFolder) {
                          onShowFolderInfo({ name: currentFolder.name, path: currentFolder.path });
                        }
                        setContextMenu(null);
                      }} onClose={() => setContextMenu(null)} />
                      <ContextMenuItem icon={<Plane className="w-3.5 h-3.5" />} label={t('folder.openDir')} onClick={() => {
                        if (currentFolder && currentFolder.path) {
                          void onOpenFolderPath(currentFolder.path);
                        }
                        setContextMenu(null);
                      }} onClose={() => setContextMenu(null)} />
                      <ContextMenuItem icon={<RefreshCw className="w-3.5 h-3.5" />} label="Refresh" onClick={() => {
                        onRefresh(contextMenu.folderId);
                        setContextMenu(null);
                      }} onClose={() => setContextMenu(null)} />
                    </>
                  )}
                  
                  <div className="h-px bg-[var(--border-color)] my-1.5 mx-2" />
                  <ContextMenuItem icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />} label="Clear Photos" onClick={() => { 
                    onClearPhotos(contextMenu.folderId);
                    setContextMenu(null);
                  }} danger onClose={() => setContextMenu(null)} />
                  {/* 未分类目录不需要删除选项 */}
                  {!isUncategorized && (
                    <ContextMenuItem icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />} label={t('folder.delete')} onClick={() => { 
                      onDeleteFolderConfirm(contextMenu.folderId);
                      setContextMenu(null);
                    }} danger onClose={() => setContextMenu(null)} />
                  )}
                </motion.div>
              );
            })()}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

