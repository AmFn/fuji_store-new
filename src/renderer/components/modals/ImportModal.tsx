import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Check, Folder as FolderIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CustomSelect } from '../common/CustomSelect';
import { Photo, Folder } from '../../types';
import { convertDbFolderToFolder } from '../../utils/fileUtils';

interface User {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

interface ImportModalProps {
  onClose: () => void;
  user: User | null;
  theme: string;
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
  initialType: 'files' | 'folders';
  activeFolderId: string | null;
  folders: Folder[];
}

function ImportModal({ onClose, user, theme, setFolders, setPhotos, initialType, activeFolderId, folders }: ImportModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedLocalPaths, setSelectedLocalPaths] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [folderName, setFolderName] = useState('');
  const [importMode, setImportMode] = useState<'create' | 'import'>(initialType === 'folders' ? 'create' : 'import');
  const [selectedDestFolderId, setSelectedDestFolderId] = useState<string | null>(() => {
    if (activeFolderId) return activeFolderId;
    const uncategorized = folders.find(f => f.name === '未分类');
    return uncategorized?.id || null;
  });
  const [folderPath, setFolderPath] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      // 直接使用 HTML input 选择的文件路径
      const filePaths = Array.from(e.target.files).map(file => file.path);
      setSelectedLocalPaths(filePaths);
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFolderPath(e.target.files[0].path);
      setFolderName(e.target.files[0].name);
    }
  };

  const handleImport = async () => {
    if (importMode === 'import' && files.length === 0 && selectedLocalPaths.length === 0 && !folderPath) return;
    if (importMode === 'create' && !folderName) return;

    setImporting(true);
    setProgress(0);

    try {
      if (importMode === 'create') {
        const newFolder = {
          name: folderName,
          parentId: selectedDestFolderId || null,
          path: null,
          type: 'logical',
          ownerId: user?.uid || 'demo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          photoCount: 0
        };
        
        // 保存到数据库
        if (window.electronAPI.createFolder) {
          // 转换 parentId 为有效的整数，如果是字符串则转换为 null
          const parentId = selectedDestFolderId && !isNaN(Number(selectedDestFolderId)) ? Number(selectedDestFolderId) : null;
          const folderToCreate = {
            ...newFolder,
            parentId: parentId
          };
          const createdFolder = await window.electronAPI.createFolder(folderToCreate);
          
          // 触发库更新事件，刷新文件夹列表
          if (window.electronAPI.triggerLibraryUpdate) {
            await window.electronAPI.triggerLibraryUpdate();
          }

          if (createdFolder) {
            setFolders(prev => [...prev, convertDbFolderToFolder(createdFolder)]);
          }
        }
      } else {
        // Import files
        if (window.electronAPI) {
          if (initialType === 'files') {
            if (files.length > 0) {
              // Use electronAPI to import files
              await window.electronAPI.importFiles({
                files: files.map(file => file.path),
                targetFolderId: selectedDestFolderId
              });
            } else if (selectedLocalPaths.length > 0) {
              // Use electronAPI to import files from local paths
              await window.electronAPI.importFiles({
                files: selectedLocalPaths,
                targetFolderId: selectedDestFolderId
              });
            }
          } else if (initialType === 'folders' && folderPath) {
            // Use electronAPI to import folder
            const importedFolder = await window.electronAPI.importFolder({
              folderPath,
              targetFolderId: selectedDestFolderId || null
            });
            
            if (importedFolder) {
              // 保存到数据库
              if (window.electronAPI.createFolder) {
                // 转换 parentId 为有效的整数，如果是字符串则转换为 null
                const parentId = selectedDestFolderId && !isNaN(Number(selectedDestFolderId)) ? Number(selectedDestFolderId) : null;
                const folderToCreate = {
                  ...importedFolder,
                  parentId: parentId
                };
                const createdFolder = await window.electronAPI.createFolder(folderToCreate);
                if (createdFolder) {
                  if (window.electronAPI.assignFolderByPath && importedFolder.path) {
                    await window.electronAPI.assignFolderByPath(createdFolder.id, importedFolder.path, true);
                  }
                  setFolders(prev => [...prev, convertDbFolderToFolder(createdFolder)]);
                }
              }
            }
          }
          
          // 触发库更新事件，刷新照片列表
          if (window.electronAPI.triggerLibraryUpdate) {
            await window.electronAPI.triggerLibraryUpdate();
          }
        }
      }
    } catch (error) {
      console.error('Error during import:', error);
    } finally {
      setImporting(false);
      onClose();
    }
  };

  const handlePickLocal = async () => {
    if (!window.electronAPI) return;
    if (initialType === 'files') {
      const filePaths = await window.electronAPI.pickFiles();
      if (filePaths && filePaths.length > 0) {
        setSelectedLocalPaths(filePaths);
      }
      return;
    }
    const pickedFolder = await window.electronAPI.pickFolder();
    if (pickedFolder) {
      setFolderPath(pickedFolder);
      setFolderName(pickedFolder.split(/[\\/]/).pop() || pickedFolder);
      setSelectedLocalPaths([pickedFolder]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="glass w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
              {importMode === 'import' ? <Plus className="w-6 h-6 text-blue-500" /> : <FolderIcon className="w-6 h-6 text-blue-500" />}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{importMode === 'import' ? 'Import System Folder' : 'Create Logical Folder'}</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {importMode === 'import' ? 'Select a directory to import JPG and RAF photos' : 'Add a new folder to your library structure'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-10 space-y-8">
          {initialType === 'folders' && (
            <div className="flex p-1 bg-slate-500/5 rounded-xl border border-[var(--border-color)]">
              <button
                onClick={() => setImportMode('create')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  importMode === 'create' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Create Only
              </button>
              <button
                onClick={() => setImportMode('import')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  importMode === 'import' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Import System
              </button>
            </div>
          )}

          {importMode === 'create' ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Folder Name</label>
                <input
                  type="text"
                  className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold"
                  placeholder="e.g. My Fuji Photos"
                  value={folderName}
                  onChange={e => setFolderName(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parent Folder</label>
                <CustomSelect
                  value={selectedDestFolderId || ''}
                  onChange={(val) => setSelectedDestFolderId(val || null)}
                  placeholder="Root Library"
                  options={folders.map(f => ({ label: f.name, value: f.id }))}
                />
              </div>
              <button
                onClick={handleImport}
                disabled={!folderName}
                className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <Check className="w-5 h-5" />
                Create Folder
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <div
                className={cn(
                  "border-4 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center space-y-6 transition-all cursor-pointer",
                  (files.length > 0 || selectedLocalPaths.length > 0) ? "border-blue-500/30 bg-blue-500/5" : "border-slate-500/10 hover:border-blue-500/30 hover:bg-blue-500/5"
                )}
                onClick={() => {
                  if (window.electronAPI) {
                    void handlePickLocal();
                  } else {
                    initialType === 'files' ? fileInputRef.current?.click() : folderInputRef.current?.click();
                  }
                }}
              >
                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center">
                  {initialType === 'files' ? <Plus className="w-10 h-10 text-blue-500" /> : <FolderIcon className="w-10 h-10 text-blue-500" />}
                </div>
                <div className="text-center space-y-2">
                  <p className="font-black text-xl tracking-tight">
                    {(selectedLocalPaths.length > 0 || files.length > 0)
                      ? `${selectedLocalPaths.length || files.length} items selected`
                      : `Click to select ${initialType === 'files' ? 'photos' : 'folder'}`}
                  </p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {initialType === 'files' ? 'Supports JPG and RAF formats' : 'All photos in the folder will be imported'}
                  </p>
                </div>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.raf"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
                <input
                  type="file"
                  {...({ webkitdirectory: "", directory: "" } as any)}
                  className="hidden"
                  ref={folderInputRef}
                  onChange={handleFolderSelect}
                />
              </div>

              {(files.length > 0 || selectedLocalPaths.length > 0 || folderPath) && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-slate-400">{selectedLocalPaths.length || files.length} files ready to import</span>
                    <button onClick={() => { setFiles([]); setSelectedLocalPaths([]); setFolderPath(''); }} className="text-red-500 hover:text-red-600">Clear</button>
                  </div>
                  
                  {/* Add target folder selection for file imports */}
                  {initialType === 'files' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Folder</label>
                      <CustomSelect
                        value={selectedDestFolderId || ''}
                        onChange={(val) => setSelectedDestFolderId(val || null)}
                        placeholder="Select target folder"
                        options={folders.map(f => ({ label: f.name, value: f.id }))}
                      />
                    </div>
                  )}

                  {importing ? (
                    <div className="space-y-4">
                      <div className="h-3 bg-slate-500/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Importing... {progress}%</p>
                    </div>
                  ) : (
                    <button
                      onClick={handleImport}
                      className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Start Import
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export { ImportModal };
