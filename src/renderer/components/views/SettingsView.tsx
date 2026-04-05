import React, { useState } from 'react';
import { Sun, Moon, Trash2, RotateCcw, Check, X } from 'lucide-react';
import { Folder } from '../../types';
import { ConfirmModal } from '../modals/ConfirmModal';

interface SettingsViewProps {
  theme: string;
  setTheme: (t: 'light' | 'dark') => void;
  folders: Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  cloudSyncEnabled: boolean;
  setCloudSyncEnabled: (v: boolean) => void;
  onFoldersChanged: React.Dispatch<React.SetStateAction<Folder[]>>;
}

export function SettingsView({ 
  theme, 
  setTheme, 
  folders, 
  setFolders,
  cloudSyncEnabled,
  setCloudSyncEnabled,
  onFoldersChanged
}: SettingsViewProps) {
  const [showRemoveFolderConfirm, setShowRemoveFolderConfirm] = useState<{ show: boolean, folderId: string }>({ show: false, folderId: '' });
  const [showClearPhotosConfirm, setShowClearPhotosConfirm] = useState<boolean>(false);

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
    setShowRemoveFolderConfirm({ show: true, folderId: id });
  };

  const handleRemoveFolderConfirm = async () => {
    const folderId = showRemoveFolderConfirm.folderId;
    if (window.electronAPI?.deleteFolder) {
      await window.electronAPI.deleteFolder(folderId);
    }
    onFoldersChanged(prev => prev.filter(f => f.id !== folderId));
    setShowRemoveFolderConfirm({ show: false, folderId: '' });
  };

  const handleClearPhotos = () => {
    setShowClearPhotosConfirm(true);
  };

  const handleClearPhotosConfirm = () => {
    if (window.electronAPI?.clearAllPhotos) {
      window.electronAPI.clearAllPhotos();
    }
    setShowClearPhotosConfirm(false);
  };

  const clearCache = async () => {
    if (!window.electronAPI?.clearThumbnailCache) return;
    const result = await window.electronAPI.clearThumbnailCache();
    if (!result?.success) {
      console.error('clear cache failed:', result?.error);
    }
  };

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-4xl font-black tracking-tighter mb-6">Settings</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">
          Customize your Fuji Store experience
        </p>

        <div className="space-y-8">
          {/* General Settings */}
          <section className="glass-card rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-6">General</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Theme</h4>
                  <p className="text-xs text-slate-400">Choose your preferred theme</p>
                </div>
                <button 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-3 rounded-2xl bg-slate-500/5 border border-[var(--border-color)] transition-all"
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Cloud Sync</h4>
                  <p className="text-xs text-slate-400">Sync your photos and recipes across devices</p>
                </div>
                <button 
                  onClick={() => setCloudSyncEnabled(!cloudSyncEnabled)}
                  className={cloudSyncEnabled 
                    ? "p-3 rounded-2xl bg-green-500 text-white transition-all"
                    : "p-3 rounded-2xl bg-slate-500/5 border border-[var(--border-color)] transition-all"
                  }
                >
                  {cloudSyncEnabled ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </section>

          {/* Folders */}
          <section className="glass-card rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-6">Folders</h3>
            <div className="space-y-4">
              {folders.map(folder => {
                const isUncategorized = folder.name === '未分类';
                return (
                  <div key={folder.id} className="flex items-center justify-between p-4 border border-[var(--border-color)] rounded-2xl">
                    <div>
                      <h4 className="font-semibold">{folder.name}</h4>
                      <p className="text-xs text-slate-400">{folder.path}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isUncategorized && (
                        <button 
                          onClick={() => toggleSubfolders(folder.id)}
                          className={folder.includeSubfolders 
                            ? "px-4 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold transition-all"
                            : "px-4 py-2 rounded-xl bg-slate-500/5 border border-[var(--border-color)] text-xs font-bold transition-all"
                          }
                        >
                          {folder.includeSubfolders ? 'Include Subfolders' : 'Exclude Subfolders'}
                        </button>
                      )}
                      {!isUncategorized && (
                        <button 
                          onClick={() => removeFolder(folder.id)}
                          className="p-2 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4 text-slate-300 hover:text-red-500 transition-all" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Maintenance */}
          <section className="glass-card rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-6">Maintenance</h3>
            <div className="space-y-4">
              <button 
                onClick={clearCache}
                className="w-full flex items-center justify-between p-4 border border-[var(--border-color)] rounded-2xl hover:bg-slate-500/5 transition-all"
              >
                <div>
                  <h4 className="font-semibold">Clear Thumbnail Cache</h4>
                  <p className="text-xs text-slate-400">Free up disk space by clearing cached thumbnails</p>
                </div>
                <RotateCcw className="w-5 h-5 text-slate-400" />
              </button>

              <button 
                onClick={handleClearPhotos}
                className="w-full flex items-center justify-between p-4 border border-red-500/20 rounded-2xl hover:bg-red-500/5 transition-all text-red-500"
              >
                <div>
                  <h4 className="font-semibold">Clear All Photos</h4>
                  <p className="text-xs">Remove all photos from your library</p>
                </div>
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Confirm Modals */}
      <React.Fragment>
        {showRemoveFolderConfirm.show && (
          <ConfirmModal 
            title="删除文件夹"
            message="确定要删除此文件夹吗？此操作无法撤销。"
            confirmLabel="删除"
            onConfirm={handleRemoveFolderConfirm}
            onCancel={() => setShowRemoveFolderConfirm({ show: false, folderId: '' })}
            variant="danger"
          />
        )}
        {showClearPhotosConfirm && (
          <ConfirmModal 
            title="清空所有照片"
            message="确定要清空所有照片吗？此操作无法撤销。"
            confirmLabel="清空"
            onConfirm={handleClearPhotosConfirm}
            onCancel={() => setShowClearPhotosConfirm(false)}
            variant="danger"
          />
        )}
      </React.Fragment>
    </div>
  );
}