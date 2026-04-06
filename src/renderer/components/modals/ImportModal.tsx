import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Check, Folder as FolderIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CustomSelect } from '../common/CustomSelect';
import { Photo, Folder } from '../../types';
import { convertDbFolderToFolder } from '../../utils/fileUtils';
import { useLanguage } from '../../hooks/useLanguage';

interface User {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

export interface ImportQueuePayload {
  type: 'files' | 'folders';
  filePaths?: string[];
  folderPath?: string;
  folderName?: string;
  targetFolderId: string | null;
  allowedFormats: string[] | null;
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
  onImportCompleted?: () => Promise<void> | void;
  onQueueImport?: (payload: ImportQueuePayload) => void;
}

function ImportModal({ onClose, user, theme, setFolders, setPhotos, initialType, activeFolderId, folders, onImportCompleted, onQueueImport }: ImportModalProps) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<File[]>([]);
  const [selectedLocalPaths, setSelectedLocalPaths] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [queuedToBackground, setQueuedToBackground] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStats, setProgressStats] = useState({
    total: 0,
    scanned: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  });
  const [folderName, setFolderName] = useState('');
  const [importMode, setImportMode] = useState<'create' | 'import'>(initialType === 'folders' ? 'create' : 'import');
  const [selectedDestFolderId, setSelectedDestFolderId] = useState<string | null>(() => {
    if (initialType === 'folders') return activeFolderId || null;
    if (activeFolderId) return activeFolderId;
    const uncategorized = folders.find(f => f.name === '未分类');
    return uncategorized?.id || null;
  });
  const [folderPath, setFolderPath] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['JPG', 'RAF']);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const toggleFormat = (format: string) => {
    setSelectedFormats(prev => {
      if (prev.includes(format)) {
        return prev.filter(f => f !== format);
      }
      return [...prev, format];
    });
  };

  const toggleAllFormats = () => {
    if (selectedFormats.length === 2) {
      setSelectedFormats([]);
    } else {
      setSelectedFormats(['JPG', 'RAF']);
    }
  };

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
      const firstFile = e.target.files[0] as File & { webkitRelativePath?: string };
      if (!firstFile) return;
      let detectedFolderPath = firstFile.path;
      let detectedFolderName = firstFile.name;

      if (firstFile.webkitRelativePath && firstFile.webkitRelativePath.includes('/')) {
        const rootFolderName = firstFile.webkitRelativePath.split('/')[0];
        const marker = `\\${rootFolderName}\\`;
        const markerIndex = firstFile.path.lastIndexOf(marker);
        if (markerIndex > 0) {
          detectedFolderPath = firstFile.path.slice(0, markerIndex + marker.length - 1);
          detectedFolderName = rootFolderName;
        }
      }

      setFolderPath(detectedFolderPath);
      setFolderName(detectedFolderName);
    }
  };

  const pickScanStats = (obj: any) => {
    const source = obj?.finalProgress || obj || {};
    const scanned = Number(source.scanned || 0);
    const success = Number(source.indexed || source.success || 0);
    const failed = Number(source.failed || 0);
    const skipped = Number(source.skipped || 0);
    return { scanned, success, failed, skipped };
  };

  const buildQueuePayload = (): ImportQueuePayload | null => {
    const allowedFormats = selectedFormats.length === 2 ? null : selectedFormats;
    if (importMode !== 'import') return null;
    if (initialType === 'files') {
      const filePaths = files.length > 0 ? files.map(file => file.path) : selectedLocalPaths;
      if (!filePaths || filePaths.length === 0) return null;
      return {
        type: 'files',
        filePaths,
        targetFolderId: selectedDestFolderId || null,
        allowedFormats,
      };
    }
    if (!folderPath) return null;
    return {
      type: 'folders',
      folderPath,
      folderName: folderName || folderPath.split(/[\\/]/).pop() || folderPath,
      targetFolderId: selectedDestFolderId || null,
      allowedFormats,
    };
  };

  const handleImport = async () => {
    if (importMode === 'import' && files.length === 0 && selectedLocalPaths.length === 0 && !folderPath) return;
    if (importMode === 'create' && !folderName) return;
    if (selectedFormats.length === 0) return;

    // 统一走后台导入队列逻辑
    if (importMode === 'import') {
      const payload = buildQueuePayload();
      if (!payload || !onQueueImport) return;
      onQueueImport(payload);
      setImporting(true);
      setQueuedToBackground(true);
      setProgress(100);
      return;
    }

    setImporting(true);
    setProgress(0);
    setProgressStats({ total: 0, scanned: 0, success: 0, failed: 0, skipped: 0 });

    const allowedFormats = selectedFormats.length === 2 ? null : selectedFormats;
    let scanProgressTimer: ReturnType<typeof setInterval> | null = null;
    let importSummary: { success: number; failed: number; skipped?: number; total?: number } | null = null;

    try {
      const startScanProgressPolling = () => {
        if (!window.electronAPI?.getScanProgress) return;
        scanProgressTimer = setInterval(async () => {
          try {
            const p = await window.electronAPI.getScanProgress(folderPath || selectedLocalPaths[0] || '');
            if (!p) return;
            const scanned = Number(p.scanned || 0);
            const indexed = Number(p.indexed || 0);
            const failed = Number(p.failed || 0);
            const skipped = Number(p.skipped || 0);
            const processed = indexed + failed + skipped;
            setProgressStats(prev => ({
              ...prev,
              scanned,
              success: indexed,
              failed,
              skipped,
            }));
            if (scanned > 0) {
              const current = Math.min(99, Math.round((processed / scanned) * 100));
              setProgress(prev => (current > prev ? current : prev));
            }
          } catch {
          }
        }, 300);
      };
      const stopScanProgressPolling = () => {
        if (scanProgressTimer) {
          clearInterval(scanProgressTimer);
          scanProgressTimer = null;
        }
      };

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
        
        if (window.electronAPI.createFolder) {
          const parentId = selectedDestFolderId && !isNaN(Number(selectedDestFolderId)) ? Number(selectedDestFolderId) : null;
          const folderToCreate = {
            ...newFolder,
            parentId: parentId
          };
          const createdFolder = await window.electronAPI.createFolder(folderToCreate);
          
          if (window.electronAPI.triggerLibraryUpdate) {
            await window.electronAPI.triggerLibraryUpdate();
          }

          if (createdFolder) {
            setFolders(prev => [...prev, convertDbFolderToFolder(createdFolder)]);
          }
        }
      } else {
        if (window.electronAPI) {
          if (initialType === 'files') {
            const importFilePaths = files.length > 0 ? files.map(file => file.path) : selectedLocalPaths;
            const total = importFilePaths.length;
            let success = 0;
            let failed = 0;
            setProgressStats({ total, scanned: total, success: 0, failed: 0, skipped: 0 });
            for (let i = 0; i < total; i++) {
              try {
                await window.electronAPI.importFiles({
                  files: [importFilePaths[i]],
                  targetFolderId: selectedDestFolderId
                });
                success += 1;
              } catch {
                failed += 1;
              }
              setProgressStats({ total, scanned: total, success, failed, skipped: 0 });
              setProgress(Math.min(99, Math.round(((i + 1) / total) * 100)));
            }
            importSummary = { total, success, failed, skipped: 0 };
          } else if (initialType === 'folders' && folderPath) {
            startScanProgressPolling();
            const importResult = await window.electronAPI.importFolder({
              folderPath,
              targetFolderId: selectedDestFolderId || null,
              allowedFormats,
            });
            stopScanProgressPolling();

            if (importResult?.folder) {
              setFolders(prev => [...prev, convertDbFolderToFolder(importResult.folder)]);
            }

            const { scanned, success, failed, skipped } = pickScanStats(importResult);
            let finalScanned = scanned;
            let finalSuccess = success;
            let finalFailed = failed;
            let finalSkipped = skipped;
            if (finalScanned === 0 && window.electronAPI?.getScanProgress) {
              const latestProgress = await window.electronAPI.getScanProgress(folderPath);
              const latest = pickScanStats(latestProgress);
              finalScanned = latest.scanned;
              finalSuccess = latest.success;
              finalFailed = latest.failed;
              finalSkipped = latest.skipped;
            }
            setProgressStats({
              total: finalScanned,
              scanned: finalScanned,
              success: finalSuccess,
              failed: finalFailed,
              skipped: finalSkipped,
            });
            importSummary = { total: finalScanned, success: finalSuccess, failed: finalFailed, skipped: finalSkipped };
          }

          setProgress(100);
          if (window.electronAPI.triggerLibraryUpdate) {
            await window.electronAPI.triggerLibraryUpdate();
          }
          await onImportCompleted?.();
          if (importSummary) {
            window.alert(
              `导入完成\n成功: ${importSummary.success} 张\n失败: ${importSummary.failed} 张\n跳过: ${importSummary.skipped || 0} 张`
            );
          }
        }
      }
    } catch (error) {
      console.error('Error during import:', error);
    } finally {
      if (scanProgressTimer) {
        clearInterval(scanProgressTimer);
      }
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
              <h2 className="text-2xl font-black tracking-tight">{importMode === 'import' ? t('import.title') : t('import.createTitle')}</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {importMode === 'import' ? t('import.selectDirectory') : t('import.addFolder')}
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
                {t('import.createOnly')}
              </button>
              <button
                onClick={() => setImportMode('import')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  importMode === 'import' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-slate-200"
                )}
              >
                {t('import.importSystem')}
              </button>
            </div>
          )}

          {importMode === 'create' ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('import.folderName')}</label>
                <input
                  type="text"
                  className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold"
                  placeholder="e.g. My Fuji Photos"
                  value={folderName}
                  onChange={e => setFolderName(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('import.parentFolder')}</label>
                <CustomSelect
                  value={selectedDestFolderId || ''}
                  onChange={(val) => setSelectedDestFolderId(val || null)}
                  placeholder={t('import.rootLibrary')}
                  options={folders.map(f => ({ label: f.name, value: f.id }))}
                />
              </div>
              <button
                onClick={handleImport}
                disabled={!folderName}
                className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <Check className="w-5 h-5" />
                {t('import.createFolder')}
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {initialType === 'folders' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('import.importFormats')}</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleFormat('JPG')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border",
                        selectedFormats.includes('JPG') 
                          ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20" 
                          : "bg-slate-500/5 border-[var(--border-color)] text-slate-400 hover:border-blue-500/30"
                      )}
                    >
                      JPG
                    </button>
                    <button
                      onClick={() => toggleFormat('RAF')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border",
                        selectedFormats.includes('RAF') 
                          ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20" 
                          : "bg-slate-500/5 border-[var(--border-color)] text-slate-400 hover:border-blue-500/30"
                      )}
                    >
                      RAF
                    </button>
                    <button
                      onClick={toggleAllFormats}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border",
                        selectedFormats.length === 2 
                          ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20" 
                          : "bg-slate-500/5 border-[var(--border-color)] text-slate-400 hover:border-green-500/30"
                      )}
                    >
                      {t('filter.all')}
                    </button>
                  </div>
                </div>
              )}
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
                      ? `${selectedLocalPaths.length || files.length} ${t('import.itemsSelected')}`
                      : `${t('import.clickToSelect')} ${initialType === 'files' ? t('import.photos') : t('import.folder')}`}
                  </p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {initialType === 'files' ? t('import.supportsFormats') : initialType === 'folders' && selectedFormats.length > 0 
                      ? `${t('import.willImport')} ${selectedFormats.join(' ' + t('import.and') + ' ')} ${t('import.files')}` 
                      : t('import.allPhotosImported')}
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
                    <span className="text-slate-400">{selectedLocalPaths.length || files.length} {t('import.filesReadyToImport')}</span>
                    <button onClick={() => { setFiles([]); setSelectedLocalPaths([]); setFolderPath(''); }} className="text-red-500 hover:text-red-600">{t('import.clear')}</button>
                  </div>
                  
                  {(initialType === 'files' || initialType === 'folders') && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {initialType === 'folders' ? t('import.parentFolder') : t('import.targetFolder')}
                      </label>
                      <CustomSelect
                        value={selectedDestFolderId || ''}
                        onChange={(val) => setSelectedDestFolderId(val || null)}
                        placeholder={initialType === 'folders' ? t('import.rootLibrary') : t('import.selectTargetFolder')}
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
                      {queuedToBackground ? (
                        <>
                          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                            已加入后台导入队列
                          </p>
                          <p className="text-center text-[11px] font-bold text-slate-400">
                            你可以点击下方“后台导入”继续在任务面板查看进度
                          </p>
                          <button
                            onClick={onClose}
                            className="w-full py-4 rounded-2xl font-black border border-[var(--border-color)] text-blue-500 bg-[var(--bg-primary)] hover:bg-blue-500/5 transition-all"
                          >
                            后台导入
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">{t('import.importing')}... {progress}%</p>
                          <p className="text-center text-[11px] font-bold text-slate-400">
                            成功 {progressStats.success} · 失败 {progressStats.failed} · 跳过 {progressStats.skipped}
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleImport}
                      disabled={initialType === 'folders' && selectedFormats.length === 0}
                      className={cn(
                        "w-full py-5 text-white rounded-2xl font-black shadow-lg transition-all flex items-center justify-center gap-3",
                        (initialType === 'folders' && selectedFormats.length === 0)
                          ? "bg-slate-500/50 cursor-not-allowed"
                          : "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
                      )}
                    >
                      <Check className="w-5 h-5" />
                      {t('import.startImport')}
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
