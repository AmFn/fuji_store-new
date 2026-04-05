import React, { useState } from 'react';
import { Sun, Moon, Trash2, RotateCcw, Check, X, FolderOpen } from 'lucide-react';
import { ConfirmModal } from '../modals/ConfirmModal';
import { useLanguage } from '../../hooks/useLanguage';

interface SettingsViewProps {
  theme: string;
  setTheme: (t: 'light' | 'dark') => void;
  cloudSyncEnabled: boolean;
  setCloudSyncEnabled: (v: boolean) => void;
  thumbnailDir?: string;
  onCacheDirChange?: (dir: string) => void;
}

export function SettingsView({ 
  theme, 
  setTheme, 
  cloudSyncEnabled,
  setCloudSyncEnabled,
  thumbnailDir,
  onCacheDirChange
}: SettingsViewProps) {
  const { t, language, setLanguage } = useLanguage();
  const [showClearPhotosConfirm, setShowClearPhotosConfirm] = useState<boolean>(false);
  const [cacheDir, setCacheDir] = useState<string>(thumbnailDir || '');

  const handleSelectCacheDir = async () => {
    if (!window.electronAPI?.pickFolder) return;
    const dir = await window.electronAPI.pickFolder();
    if (dir) {
      setCacheDir(dir);
      if (onCacheDirChange) {
        onCacheDirChange(dir);
      }
    }
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
        <h2 className="text-4xl font-black tracking-tighter mb-6">{t('settings.title')}</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">
          {t('settings.subtitle')}
        </p>

        <div className="space-y-8">
          <section className="glass-card rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-6">{t('settings.general')}</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{t('settings.theme')}</h4>
                  <p className="text-xs text-slate-400">{t('settings.themeDesc')}</p>
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
                  <h4 className="font-semibold">{t('settings.language')}</h4>
                  <p className="text-xs text-slate-400">{t('settings.languageDesc')}</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-500/5 border border-[var(--border-color)] rounded-xl p-1">
                  <button 
                    onClick={() => setLanguage('zh')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${language === 'zh' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    中文
                  </button>
                  <button 
                    onClick={() => setLanguage('en')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${language === 'en' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    English
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{t('settings.cloudSync')}</h4>
                  <p className="text-xs text-slate-400">{t('settings.cloudSyncDesc')}</p>
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

          <section className="glass-card rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-6">{t('settings.cacheDirectory')}</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold">{t('settings.currentCacheDirectory')}</h4>
                  <p className="text-xs text-slate-400 truncate">{cacheDir || t('settings.cacheDirectoryDesc')}</p>
                </div>
                <button 
                  onClick={handleSelectCacheDir}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-500 rounded-xl text-xs font-bold hover:bg-blue-500/20 transition-all"
                >
                  <FolderOpen className="w-4 h-4" />
                  {t('settings.selectCacheDirectory')}
                </button>
              </div>
            </div>
          </section>

          <section className="glass-card rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-6">{t('settings.maintenance')}</h3>
            <div className="space-y-4">
              <button 
                onClick={clearCache}
                className="w-full flex items-center justify-between p-4 border border-[var(--border-color)] rounded-2xl hover:bg-slate-500/5 transition-all"
              >
                <div>
                  <h4 className="font-semibold">{t('settings.clearThumbnailCache')}</h4>
                  <p className="text-xs text-slate-400">{t('settings.clearThumbnailCacheDesc')}</p>
                </div>
                <RotateCcw className="w-5 h-5 text-slate-400" />
              </button>

              <button 
                onClick={handleClearPhotos}
                className="w-full flex items-center justify-between p-4 border border-red-500/20 rounded-2xl hover:bg-red-500/5 transition-all text-red-500"
              >
                <div>
                  <h4 className="font-semibold">{t('settings.clearAllPhotos')}</h4>
                  <p className="text-xs">{t('settings.clearAllPhotosDesc')}</p>
                </div>
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </section>
        </div>
      </div>

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
    </div>
  );
}
