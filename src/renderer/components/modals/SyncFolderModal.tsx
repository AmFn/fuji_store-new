import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, RefreshCw, Plus } from 'lucide-react';
import { Folder, Photo } from '../../types';

interface SyncFolderModalProps {
  onClose: () => void;
  folderId: string;
  folders: Folder[];
  setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
}

function SyncFolderModal({ onClose, folderId, folders, setPhotos }: SyncFolderModalProps) {
  const folder = folders.find(f => f.id === folderId);
  const [scanning, setScanning] = useState(true);
  const [message, setMessage] = useState('Scanning folder...');
  const [newFiles, setNewFiles] = useState<{ id: string; name: string; date: string; size: string; filmMode: string }[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!folder?.path || folder.type !== 'physical' || !window.electronAPI) {
        setMessage('Only physical folders can be refreshed.');
        setScanning(false);
        return;
      }
      try {
        // Use electronAPI to scan folder for new files
        const scanResult = await window.electronAPI.scanDirectoryForNewFiles(folder.path);
        const newFiles = scanResult?.newFiles || [];
        
        if (newFiles && newFiles.length > 0) {
          setNewFiles(newFiles);
          // 默认全选所有文件
          const allFileIds = newFiles.map(file => file.id);
          setSelectedFiles(allFileIds);
          setMessage(`Found ${newFiles.length} new files`);
        } else {
          setMessage('No new files found.');
        }
      } catch (err) {
        setMessage(`Refresh failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setScanning(false);
      }
    };
    void run();
  }, [folder?.path, folder?.type]);

  const handleToggleFile = (fileId: string) => {
    setSelectedFiles(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      } else {
        return [...prev, fileId];
      }
    });
  };

  const handleSync = async () => {
    if (selectedFiles.length === 0) {
      onClose();
      return;
    }

    try {
      setScanning(true);
      setMessage('Syncing files...');

      if (window.electronAPI) {
        // 从 newFiles 中获取选中的文件路径
        const selectedFilePaths = newFiles
          .filter(file => selectedFiles.includes(file.id))
          .map(file => file.path);
        
        // 扫描并添加选中的文件
        const scanResult = await window.electronAPI.scanFiles(selectedFilePaths);
        
        // 重新加载照片列表
        if (window.electronAPI.triggerLibraryUpdate) {
          await window.electronAPI.triggerLibraryUpdate();
        }
        
        setMessage(`Successfully synced ${selectedFilePaths.length} files`);
      }

      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Sync error:', err);
      setMessage(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="glass w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
              <RefreshCw className={`w-6 h-6 text-blue-500 ${scanning ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">Syncing Folder</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {folder?.name || 'Unknown'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-10 space-y-6">
          {scanning ? (
            <div className="space-y-4">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">{message}</p>
              <div className="h-3 bg-slate-500/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5 }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">{message}</p>
              {newFiles.length > 0 && (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {newFiles.map(file => (
                    <div
                      key={file.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center gap-4 ${selectedFiles.includes(file.id) ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-500/5 border-[var(--border-color)]'}`}
                    >
                      <div 
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${selectedFiles.includes(file.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-500/30 hover:border-blue-500'}`}
                        onClick={() => handleToggleFile(file.id)}
                      >
                        {selectedFiles.includes(file.id) && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black tracking-tight">{file.fileName}</p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{file.date}</span>
                          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{file.filmMode}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{file.size}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 border border-[var(--border-color)] text-slate-300 rounded-2xl text-sm font-bold hover:bg-slate-500/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSync}
                  disabled={selectedFiles.length === 0}
                  className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${selectedFiles.length === 0 ? 'bg-slate-500/30 text-slate-400' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                  <Plus className="w-4 h-4" />
                  Add {selectedFiles.length} Selected Files
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export { SyncFolderModal };