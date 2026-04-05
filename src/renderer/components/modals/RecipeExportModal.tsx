import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Download, Loader2, Settings } from 'lucide-react';
import { Photo } from '../../types';
import { cn } from '../../lib/utils';
import html2canvas from 'html2canvas';

interface CustomSettings {
  backgroundColor: string;
  textColor: string;
  fontFamily: 'sans' | 'serif' | 'mono' | 'display';
  borderRadius: number;
  padding: number;
  showExif: {
    wb: boolean;
    dr: boolean;
    iso: boolean;
    shutter: boolean;
    aperture: boolean;
    lens: boolean;
    camera: boolean;
  };
  layout: 'stacked' | 'split';
}

interface RecipeExportModalProps {
  photo: Photo;
  onClose: () => void;
  theme: string;
  initialTemplate?: string;
}

export function RecipeExportModal({ photo, onClose, theme, initialTemplate = 'minimal' }: RecipeExportModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplate);
  const [exporting, setExporting] = useState(false);
  const [customSettings, setCustomSettings] = useState<CustomSettings>({
    backgroundColor: theme === 'dark' ? '#0a0a0a' : '#ffffff',
    textColor: theme === 'dark' ? '#f8fafc' : '#0f172a',
    fontFamily: 'sans',
    borderRadius: 16,
    padding: 32,
    showExif: {
      wb: true,
      dr: true,
      iso: true,
      shutter: true,
      aperture: true,
      lens: true,
      camera: true
    },
    layout: 'stacked'
  });
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(exportRef.current, { 
        scale: 2,
        backgroundColor: null,
        useCORS: true
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.download = `FujiRecipe_${photo.fileName?.split('.')[0] || 'photo'}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass w-full max-w-5xl h-[90vh] rounded-[3rem] overflow-hidden flex flex-col lg:flex-row shadow-2xl"
      >
        <div className="flex-1 bg-slate-900/50 flex items-center justify-center p-8 overflow-auto">
          <div ref={exportRef} className="shadow-2xl">
            {selectedTemplate === 'minimal' && <MinimalTemplate photo={photo} />}
            {selectedTemplate === 'magazine' && <MagazineTemplate photo={photo} />}
            {selectedTemplate === 'insta' && <InstaTemplate photo={photo} />}
            {selectedTemplate === 'darktech' && <DarkTechTemplate photo={photo} />}
            {selectedTemplate === 'custom' && <CustomTemplate photo={photo} settings={customSettings} />}
          </div>
        </div>

        <div className="w-full lg:w-96 bg-[var(--bg-primary)] border-l border-[var(--border-color)] flex flex-col">
          <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Export Recipe</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Select a template to share</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-500/10 rounded-xl transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Choose Template</label>
              <div className="grid grid-cols-2 gap-4">
                {['minimal', 'magazine', 'insta', 'darktech', 'custom'].map(t => (
                  <button 
                    key={t}
                    onClick={() => setSelectedTemplate(t)}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all text-left space-y-2",
                      selectedTemplate === t 
                        ? "border-blue-500 bg-blue-500/5" 
                        : "border-transparent bg-slate-500/5 hover:bg-slate-500/10"
                    )}
                  >
                    <p className="text-xs font-black uppercase tracking-widest">{t}</p>
                    <div className="w-full aspect-video bg-slate-500/10 rounded-lg flex items-center justify-center">
                      {t === 'custom' && <Settings className="w-4 h-4 opacity-40" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedTemplate === 'custom' && (
              <div className="space-y-8 pt-4 border-t border-[var(--border-color)]">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Colors</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500">Background</p>
                      <input 
                        type="color" 
                        value={customSettings.backgroundColor}
                        onChange={(e) => setCustomSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                        className="w-full h-10 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500">Text</p>
                      <input 
                        type="color" 
                        value={customSettings.textColor}
                        onChange={(e) => setCustomSettings(prev => ({ ...prev, textColor: e.target.value }))}
                        className="w-full h-10 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Typography</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['sans', 'serif', 'mono', 'display'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setCustomSettings(prev => ({ ...prev, fontFamily: f }))}
                        className={cn(
                          "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                          customSettings.fontFamily === f ? "bg-blue-500 text-white border-blue-500" : "bg-slate-500/5 border-transparent"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Layout</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['stacked', 'split'] as const).map(l => (
                      <button
                        key={l}
                        onClick={() => setCustomSettings(prev => ({ ...prev, layout: l }))}
                        className={cn(
                          "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                          customSettings.layout === l ? "bg-blue-500 text-white border-blue-500" : "bg-slate-500/5 border-transparent"
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EXIF Fields</label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {Object.entries(customSettings.showExif).map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => setCustomSettings(prev => ({
                          ...prev,
                          showExif: { ...prev.showExif, [key]: !value }
                        }))}
                        className="flex items-center gap-2 group"
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          value ? "bg-blue-500 border-blue-500" : "border-slate-300 group-hover:border-blue-500"
                        )}>
                          {value && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{key}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Radius & Padding</label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500">
                        <span>Radius</span>
                        <span>{customSettings.borderRadius}px</span>
                      </div>
                      <input 
                        type="range" min="0" max="64" value={customSettings.borderRadius}
                        onChange={(e) => setCustomSettings(prev => ({ ...prev, borderRadius: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500">
                        <span>Padding</span>
                        <span>{customSettings.padding}px</span>
                      </div>
                      <input 
                        type="range" min="16" max="128" value={customSettings.padding}
                        onChange={(e) => setCustomSettings(prev => ({ ...prev, padding: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 border-t border-[var(--border-color)]">
            <button 
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {exporting ? 'Generating...' : 'Download JPG'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function CustomTemplate({ photo, settings }: { photo: Photo, settings: CustomSettings }) {
  const fontClass = {
    sans: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono',
    display: 'font-display'
  }[settings.fontFamily];

  const exifFields = [
    { key: 'camera', label: 'CAMERA', value: photo.cameraModel },
    { key: 'lens', label: 'LENS', value: photo.lensModel },
    { key: 'iso', label: 'ISO', value: photo.iso },
    { key: 'shutter', label: 'SHUTTER', value: photo.exposureTime },
    { key: 'aperture', label: 'APERTURE', value: photo.fNumber },
    { key: 'wb', label: 'WB', value: photo.whiteBalance },
    { key: 'dr', label: 'DR', value: photo.dynamicRange },
  ].filter(f => settings.showExif[f.key as keyof typeof settings.showExif]);

  return (
    <div 
      className={cn(
        "w-[400px] flex flex-col",
        settings.layout === 'split' ? "flex-row h-[500px]" : "min-h-[500px]",
        fontClass
      )}
      style={{ 
        backgroundColor: settings.backgroundColor, 
        color: settings.textColor,
        padding: `${settings.padding}px`
      }}
    >
      <div className={cn(
        "overflow-hidden shadow-lg mb-6",
        settings.layout === 'split' ? "w-1/2 mb-0 mr-6 h-full" : "w-full aspect-[4/5]"
      )}
      style={{ borderRadius: `${settings.borderRadius}px` }}
      >
        <img src={photo.previewUrl || photo.thumbnailUrl} className="w-full h-full object-cover" alt="" crossOrigin="anonymous" />
      </div>

      <div className={cn(
        "flex flex-col justify-center",
        settings.layout === 'split' ? "w-1/2" : "w-full"
      )}>
        <div className="mb-6">
          <h3 className="text-2xl font-black tracking-tight leading-tight">{photo.filmMode}</h3>
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mt-1">Fujifilm Recipe</p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {exifFields.map(field => (
            <div key={field.key} className="space-y-0.5">
              <p className="text-[8px] font-black uppercase tracking-widest opacity-40">{field.label}</p>
              <p className="text-[11px] font-bold truncate">{field.value || 'N/A'}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-current opacity-10 flex items-center justify-between">
          <span className="text-[8px] font-black tracking-[0.3em]">FUJI STATION</span>
          <span className="text-[8px] font-black tracking-[0.3em]">CUSTOM_GEN</span>
        </div>
      </div>
    </div>
  );
}

function MinimalTemplate({ photo }: { photo: Photo }) {
  return (
    <div className="w-[400px] bg-white p-10 flex flex-col items-center space-y-8 text-slate-900 font-sans">
      <div className="w-full aspect-[4/5] overflow-hidden rounded-sm shadow-lg">
        <img src={photo.previewUrl || photo.thumbnailUrl} className="w-full h-full object-cover" alt="" crossOrigin="anonymous" />
      </div>
      <div className="w-full space-y-6 text-center">
        <div className="space-y-1">
          <h3 className="text-2xl font-serif italic">{photo.filmMode}</h3>
          <p className="text-[10px] uppercase tracking-[0.3em] font-light text-slate-400">Fujifilm Recipe</p>
        </div>
        <div className="grid grid-cols-3 gap-y-4 text-[9px] uppercase tracking-widest font-bold border-t border-slate-100 pt-6">
          <div className="space-y-1">
            <p className="text-slate-300">WB</p>
            <p>{photo.whiteBalance}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-300">DR</p>
            <p>{photo.dynamicRange}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-300">ISO</p>
            <p>{photo.iso}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-300">NR</p>
            <p>{photo.noiseReduction}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-300">SHARP</p>
            <p>{photo.sharpness}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-300">CLARITY</p>
            <p>{photo.clarity}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MagazineTemplate({ photo }: { photo: Photo }) {
  return (
    <div className="w-[450px] bg-[#fdfcf8] p-12 flex flex-col space-y-10 text-slate-900 font-serif relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16" />
      <div className="z-10 space-y-2">
        <h3 className="text-5xl font-black tracking-tighter leading-none">{photo.filmMode?.split('/')[0]}</h3>
        <p className="text-sm font-sans font-black uppercase tracking-[0.4em] text-blue-600">The Fuji Journal</p>
      </div>
      <div className="w-full aspect-[3/4] overflow-hidden shadow-2xl relative">
        <img src={photo.previewUrl || photo.thumbnailUrl} className="w-full h-full object-cover" alt="" crossOrigin="anonymous" />
        <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md px-4 py-2 text-[10px] font-sans font-black uppercase tracking-widest">
          {photo.cameraModel}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 font-sans">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">Settings</p>
          <div className="space-y-2 text-[11px] font-bold">
            <div className="flex justify-between"><span>WB</span><span>{photo.whiteBalance}</span></div>
            <div className="flex justify-between"><span>DR</span><span>{photo.dynamicRange}</span></div>
            <div className="flex justify-between"><span>Grain</span><span>{photo.grainEffect}</span></div>
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">Tones</p>
          <div className="space-y-2 text-[11px] font-bold">
            <div className="flex justify-between"><span>Shadow</span><span>{photo.shadowTone}</span></div>
            <div className="flex justify-between"><span>Highlight</span><span>{photo.highlightTone}</span></div>
            <div className="flex justify-between"><span>Color</span><span>{photo.saturation}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstaTemplate({ photo }: { photo: Photo }) {
  return (
    <div className="w-[400px] aspect-square bg-slate-50 p-6 flex flex-col font-sans">
      <div className="flex-1 bg-white p-4 shadow-lg flex flex-col space-y-4">
        <div className="flex-1 overflow-hidden">
          <img src={photo.previewUrl || photo.thumbnailUrl} className="w-full h-full object-cover" alt="" crossOrigin="anonymous" />
        </div>
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="space-y-0.5">
            <h3 className="text-lg font-black tracking-tight">{photo.filmMode}</h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{photo.cameraModel} • {photo.lensModel}</p>
          </div>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DarkTechTemplate({ photo }: { photo: Photo }) {
  return (
    <div className="w-[400px] bg-slate-950 p-10 flex flex-col space-y-8 text-white font-mono">
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="space-y-1">
          <p className="text-[8px] text-blue-500 font-bold uppercase tracking-widest">System.Recipe</p>
          <h3 className="text-xl font-black tracking-tighter">{photo.filmMode?.toUpperCase()}</h3>
        </div>
        <div className="text-right">
          <p className="text-[8px] text-slate-500 uppercase tracking-widest">Status</p>
          <p className="text-[10px] text-green-500 font-bold">VERIFIED</p>
        </div>
      </div>
      <div className="w-full aspect-video overflow-hidden border border-white/10 relative">
        <img src={photo.previewUrl || photo.thumbnailUrl} className="w-full h-full object-cover grayscale opacity-80" alt="" crossOrigin="anonymous" />
        <div className="absolute inset-0 border-[20px] border-transparent border-t-white/5 border-l-white/5" />
      </div>
      <div className="grid grid-cols-2 gap-6 text-[10px]">
        <div className="space-y-3">
          <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">WB_SHIFT</span><span>{photo.whiteBalanceShift || '0,0'}</span></div>
          <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">ISO_SENS</span><span>{photo.iso}</span></div>
          <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">EXP_TIME</span><span>{photo.exposureTime}</span></div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">CHROME_FX</span><span>{photo.colorChromeEffect}</span></div>
          <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">GRAIN_FX</span><span>{photo.grainEffect}</span></div>
          <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">SHARP_LVL</span><span>{photo.sharpness}</span></div>
        </div>
      </div>
      <div className="pt-4 flex items-center gap-4 opacity-30">
        <div className="flex-1 h-[1px] bg-white" />
        <p className="text-[8px] tracking-[0.5em]">FUJIFILM_X_SERIES</p>
        <div className="flex-1 h-[1px] bg-white" />
      </div>
    </div>
  );
}
