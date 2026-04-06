import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Share2, Trash2, HardDrive, ExternalLink, Navigation, Info, RefreshCw } from 'lucide-react';
import { Photo, Recipe, Tag, Folder } from '../../types';
import { ConfirmModal } from './ConfirmModal';
import { CompactExif } from '../common/CompactExif';
import { FilmSettingCard } from '../common/FilmSettingCard';
import { tagService } from '../../services/tagService';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../hooks/useLanguage';
import metadataDescriptions from '../../constants/metadata-descriptions.json';
import { MetadataFieldConfig } from '../../utils/metadataParser';
import defaultConfig from '../../constants/metadata-default-config.json';

interface PhotoDetailModalProps {
  photo: Photo;
  onClose: () => void;
  recipes: Recipe[];
  folders: Folder[];
  onRecognize: (p: Photo) => void;
  onReParse?: (photo: Photo) => void;
  theme: string;
  allTags: Tag[];
  onExport: () => void;
  onUpdatePhoto: (id: string, updates: Partial<Photo>) => void;
  onDeletePhoto: (id: string) => void;
  onAddTag: (tag: Tag) => void;
  displayConfig?: Record<string, string[]>;
  metadataFields?: MetadataFieldConfig[];
}

export function PhotoDetailModal({
  photo,
  onClose,
  recipes,
  folders,
  onRecognize,
  onReParse,
  theme,
  allTags,
  onExport,
  onUpdatePhoto,
  onDeletePhoto,
  onAddTag,
  displayConfig = {},
  metadataFields = []
}: PhotoDetailModalProps) {
  type ValueMapRow = { id: string; from: string; to: string };
  const { t } = useLanguage();
  const [isFavorite, setIsFavorite] = useState(photo.isFavorite);
  const [isHidden, setIsHidden] = useState(photo.isHidden);
  const [photoTags, setPhotoTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState<'detail' | 'tags' | 'info'>('detail');
  const [metadataSearch, setMetadataSearch] = useState('');
  const [metadataContextMenu, setMetadataContextMenu] = useState<{ x: number; y: number; label: string; value: string } | null>(null);
  const [showQuickValueMapModal, setShowQuickValueMapModal] = useState(false);
  const [quickValueMapField, setQuickValueMapField] = useState<{ label: string; value: string } | null>(null);
  const [valueMapJsonPath, setValueMapJsonPath] = useState('');
  const [valueMapRows, setValueMapRows] = useState<ValueMapRow[]>([]);
  const [metadataFieldsCache, setMetadataFieldsCache] = useState<MetadataFieldConfig[]>([]);
  const [isReParsing, setIsReParsing] = useState(false);

  const createValueMapRow = (from: string = '', to: string = ''): ValueMapRow => ({
    id: `vm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    from,
    to
  });

  const valueMapToRows = (valueMap?: Record<string, string>, preferredFrom?: string): ValueMapRow[] => {
    const rows = Object.entries(valueMap || {}).map(([from, to]) => createValueMapRow(from, to));
    if (preferredFrom && !rows.some(row => row.from === preferredFrom)) {
      rows.unshift(createValueMapRow(preferredFrom, ''));
    }
    return rows.length > 0 ? rows : [createValueMapRow(preferredFrom || '', '')];
  };

  const rowsToValueMap = (rows: ValueMapRow[]): Record<string, string> => {
    const map: Record<string, string> = {};
    rows.forEach((row) => {
      const from = row.from.trim();
      const to = row.to.trim();
      if (from && to) {
        map[from] = to;
      }
    });
    return map;
  };

  const buildFieldKeyFromJsonPath = (jsonPath: string, existingFields: MetadataFieldConfig[]): string => {
    const normalized = jsonPath.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'json_path';
    const base = `jsonpath_${normalized}`.slice(0, 60);
    let key = base;
    let suffix = 1;
    const keySet = new Set(existingFields.map(field => field.key));
    while (keySet.has(key)) {
      key = `${base}_${suffix++}`;
    }
    return key;
  };
  
  const metadataJson = photo.metadataJson ? (typeof photo.metadataJson === 'string' ? JSON.parse(photo.metadataJson) : photo.metadataJson) : null;
  const photoDetailConfig = displayConfig.photoDetail || [];
  
  const getMetadataValue = (key: string): string => {
    if (!metadataJson) return '';
    return metadataJson[key] || '';
  };
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const loadTags = async () => {
      if (photo.id) {
        console.log('[PhotoDetailModal] Loading tags for photo:', photo.id, typeof photo.id);
        try {
          const tags = await tagService.getTagsByPhoto(photo.id);
          console.log('[PhotoDetailModal] Loaded tags:', tags);
          setPhotoTags(tags);
        } catch (err) {
          console.error('[PhotoDetailModal] Failed to load tags:', err);
        }
      }
    };
    loadTags();
  }, [photo.id]);

  useEffect(() => {
    const loadMetadataFields = async () => {
      const defaultFields: MetadataFieldConfig[] = Array.isArray(defaultConfig.fields) ? defaultConfig.fields as MetadataFieldConfig[] : [];
      try {
        const dbFields = await window.electronAPI?.getMetadataFields?.();
        if (Array.isArray(dbFields) && dbFields.length > 0) {
          const defaultKeys = new Set(defaultFields.map(field => field.key));
          const mergedFields = [
            ...defaultFields.map(defaultField => {
              const existing = dbFields.find((field: MetadataFieldConfig) => field.key === defaultField.key);
              return existing ? { ...defaultField, ...existing } : defaultField;
            }),
            ...dbFields.filter((field: MetadataFieldConfig) => !defaultKeys.has(field.key))
          ];
          setMetadataFieldsCache(mergedFields);
          return;
        }
      } catch (error) {
        console.error('[PhotoDetailModal] Failed to load metadata fields:', error);
      }

      try {
        const stored = localStorage.getItem('fuji_metadata_fields');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const defaultKeys = new Set(defaultFields.map(field => field.key));
            const mergedFields = [
              ...defaultFields.map(defaultField => {
                const existing = parsed.find((field: MetadataFieldConfig) => field.key === defaultField.key);
                return existing ? { ...defaultField, ...existing } : defaultField;
              }),
              ...parsed.filter((field: MetadataFieldConfig) => !defaultKeys.has(field.key))
            ];
            setMetadataFieldsCache(mergedFields);
            return;
          }
        }
      } catch (error) {
        console.error('[PhotoDetailModal] Failed to load local metadata fields:', error);
      }
      setMetadataFieldsCache(defaultFields);
    };

    loadMetadataFields();
  }, []);

  const openValueMapEditor = (jsonPathOrField: string, originalValue: string) => {
    const matchedField =
      metadataFieldsCache.find(field => field.key === jsonPathOrField) ||
      metadataFieldsCache.find(field => field.jsonPath === jsonPathOrField);
    const jsonPath = (matchedField?.jsonPath || jsonPathOrField || '').trim();
    setValueMapJsonPath(jsonPath);
    setValueMapRows(valueMapToRows(matchedField?.valueMap, originalValue));
    setQuickValueMapField({ label: matchedField?.label || jsonPathOrField, value: originalValue });
    setShowQuickValueMapModal(true);
  };

  const handleSaveQuickValueMap = async () => {
    const jsonPath = valueMapJsonPath.trim();
    if (!jsonPath) {
      alert('请填写字段 JSON Path');
      return;
    }

    const mapped = rowsToValueMap(valueMapRows);
    const existingByPath = metadataFieldsCache.find(field => field.jsonPath === jsonPath);
    const existingField = existingByPath;

    let nextFields: MetadataFieldConfig[];
    if (existingField) {
      nextFields = metadataFieldsCache.map(field => {
        if (field.key !== existingField.key) return field;
        return {
          ...field,
          jsonPath,
          valueMap: mapped
        };
      });
    } else {
      const key = buildFieldKeyFromJsonPath(jsonPath, metadataFieldsCache);
      const newField: MetadataFieldConfig = {
        key,
        label: jsonPath,
        jsonPath,
        isEnabled: false,
        isCustom: true,
        valueMap: mapped
      };
      nextFields = [...metadataFieldsCache, newField];
    }

    try {
      await window.electronAPI?.saveMetadataFields?.(nextFields);
      localStorage.setItem('fuji_metadata_fields', JSON.stringify(nextFields));
      setMetadataFieldsCache(nextFields);
    } catch (error) {
      console.error('[PhotoDetailModal] Failed to save value mapping:', error);
      alert('保存值映射失败');
      return;
    }

    setShowQuickValueMapModal(false);
    setQuickValueMapField(null);
    setValueMapJsonPath('');
    setValueMapRows([]);
  };

  const folder = folders.find(f => f.id === photo.folderId);

  const suggestions = allTags
    .filter(t => t.name.toLowerCase().includes(newTag.toLowerCase()))
    .filter(t => !photoTags.some(pt => pt.name === t.name))
    .slice(0, 5);

  const wbShift = photo.whiteBalanceShift?.split(',').map(s => s.trim()) || [];
  const wbRed = photoDetailConfig.includes('whiteBalanceShiftR') ? (getMetadataValue('whiteBalanceShiftR') || getMetadataValue('WhiteBalanceShiftR') || '0') : '';
  const wbBlue = photoDetailConfig.includes('whiteBalanceShiftB') ? (getMetadataValue('whiteBalanceShiftB') || getMetadataValue('WhiteBalanceShiftB') || '0') : '';

  const grainParts = photo.grainEffect?.split(',').map(s => s.trim()) || [];
  const grainRoughness = grainParts[0] || 'Off';
  const grainSize = grainParts[1] || 'Off';

  const renderMappableCard = (fieldKey: string, label: string, value?: string) => (
    (() => {
      const rawValue = value ? String(value) : '';
      const mappingField = metadataFieldsCache.find(field => field.key === fieldKey);
      const mappedValue = rawValue && mappingField?.valueMap?.[rawValue] !== undefined
        ? mappingField.valueMap[rawValue]
        : rawValue;
      return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        const displayValue = rawValue.trim();
        if (!displayValue || displayValue === '-') return;
        openValueMapEditor(fieldKey, displayValue);
      }}
    >
      <FilmSettingCard label={label} value={mappedValue || value} />
    </div>
      );
    })()
  );

  const getConfiguredFieldLabel = (fieldKey: string, fallback: string) => {
    const fromProps = metadataFields.find(field => field.key === fieldKey)?.label;
    if (fromProps) return fromProps;
    const fromCache = metadataFieldsCache.find(field => field.key === fieldKey)?.label;
    if (fromCache) return fromCache;
    return fallback;
  };
  
  const metadata = photo.metadataJson as Record<string, any> | null;
  const cameraModel = photo.cameraModel || (metadata?.Make || metadata?.Model ? [metadata.Make, metadata.Model].filter(Boolean).join(' ') : '');
  const lensModel = photo.lensModel || (metadata?.LensModel || '');
  const aperture = photo.aperture || (metadata?.FNumber ? (typeof metadata.FNumber === 'object' ? `${metadata.FNumber.numerator}/${metadata.FNumber.denominator}` : String(metadata.FNumber)) : '');
  const shutterSpeed = photo.shutterSpeed || (metadata?.ExposureTime ? (typeof metadata.ExposureTime === 'object' ? (metadata.ExposureTime.denominator === 1 ? String(metadata.ExposureTime.numerator) : `${metadata.ExposureTime.numerator}/${metadata.ExposureTime.denominator}`) : String(metadata.ExposureTime)) : '');
  const getIsoValue = () => {
    if (photo.iso !== undefined && photo.iso !== null && photo.iso !== 0) {
      return String(photo.iso);
    }
    if (metadata) {
      const isoKeys = ['ISOSpeedRatings', 'iso', 'ISO'];
      for (const key of isoKeys) {
        if (metadata[key]) {
          const val = Array.isArray(metadata[key]) ? metadata[key][0] : metadata[key];
          return val ? String(val) : '';
        }
      }
    }
    return '';
  };
  const iso = getIsoValue();
  const focalLength = photo.focalLength ? photo.focalLength.replace(/mm$/, '') : (metadata?.FocalLength ? (typeof metadata.FocalLength === 'object' ? `${metadata.FocalLength.numerator / metadata.FocalLength.denominator}` : String(metadata.FocalLength)) : '');

  const getDescription = (key: string): string => {
    const allDescriptions = {
      ...(metadataDescriptions.descriptions?.FujiFilm || {}),
      ...(metadataDescriptions.descriptions?.EXIF || {}),
      ...(metadataDescriptions.descriptions?.IPTC || {}),
      ...(metadataDescriptions.descriptions?.XMP || {}),
      ...(metadataDescriptions.descriptions?.File || {}),
      ...(metadataDescriptions.descriptions?.Composite || {}),
    };
    
    if (allDescriptions[key]) {
      return allDescriptions[key];
    }
    
    const parts = key.split('.');
    if (parts.length > 1) {
      return allDescriptions[parts[parts.length - 1]] || '';
    }
    
    return '';
  };

  const getAllMetadataItems = (): { label: string; value: string; description: string }[] => {
    const items: { label: string; value: string; description: string }[] = [];
    
    const flattenObject = (obj: any, prefix: string = ''): { label: string; value: string; description: string }[] => {
      const result: { label: string; value: string; description: string }[] = [];
      
      if (typeof obj !== 'object' || obj === null) {
        return result;
      }
      
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (value !== undefined && value !== null && value !== '') {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            result.push(...flattenObject(value, fullKey));
          } else {
            let displayValue: string;
            if (typeof value === 'object' && value !== null) {
              if (value instanceof Date) {
                displayValue = value.toISOString();
              } else if (Array.isArray(value)) {
                displayValue = JSON.stringify(value);
              } else {
                displayValue = String(value);
              }
            } else {
              displayValue = String(value);
            }
            const description = getDescription(key);
            result.push({ label: fullKey, value: displayValue, description });
          }
        }
      }
      
      return result;
    };
    
    if (metadataJson && typeof metadataJson === 'object') {
      const flattened = flattenObject(metadataJson);
      items.push(...flattened);
    }
    
    if (photo.cameraModel) items.push({ label: 'cameraModel', value: photo.cameraModel, description: getDescription('Model') });
    if (photo.lensModel) items.push({ label: 'lensModel', value: photo.lensModel, description: getDescription('LensModel') });
    if (photo.exposureTime) items.push({ label: 'exposureTime', value: photo.exposureTime, description: getDescription('ExposureTime') });
    if (photo.aperture) items.push({ label: 'aperture', value: String(photo.aperture), description: getDescription('FNumber') });
    if (photo.shutterSpeed) items.push({ label: 'shutterSpeed', value: photo.shutterSpeed, description: getDescription('ExposureTime') });
    if (photo.iso) items.push({ label: 'iso', value: String(photo.iso), description: getDescription('ISOSpeedRatings') });
    if (photo.focalLength) items.push({ label: 'focalLength', value: photo.focalLength, description: getDescription('FocalLength') });
    if (photo.dateTime) items.push({ label: 'dateTime', value: photo.dateTime, description: getDescription('DateTimeOriginal') });
    
    if (photo.filmMode) items.push({ label: 'filmMode', value: photo.filmMode, description: getDescription('FilmMode') });
    if (photo.whiteBalance) items.push({ label: 'whiteBalance', value: photo.whiteBalance, description: getDescription('WhiteBalance') });
    if (photo.dynamicRange) items.push({ label: 'dynamicRange', value: photo.dynamicRange, description: getDescription('DynamicRange') });
    if (photo.sharpness) items.push({ label: 'sharpness', value: photo.sharpness, description: getDescription('Sharpness') });
    if (photo.saturation) items.push({ label: 'saturation', value: photo.saturation, description: getDescription('Saturation') });
    if (photo.contrast) items.push({ label: 'contrast', value: photo.contrast, description: getDescription('Contrast') });
    if (photo.highlightTone) items.push({ label: 'highlightTone', value: photo.highlightTone, description: getDescription('Highlight') });
    if (photo.shadowTone) items.push({ label: 'shadowTone', value: photo.shadowTone, description: getDescription('Shadow') });
    if (photo.noiseReduction) items.push({ label: 'noiseReduction', value: photo.noiseReduction, description: getDescription('NoiseReduction') });
    if (photo.clarity) items.push({ label: 'clarity', value: photo.clarity, description: getDescription('Clarity') });
    if (photo.grainEffect) items.push({ label: 'grainEffect', value: photo.grainEffect, description: getDescription('GrainEffect') });
    if (photo.colorChromeEffect) items.push({ label: 'colorChromeEffect', value: photo.colorChromeEffect, description: getDescription('ColorChromeEffect') });
    if (photo.colorChromeEffectBlue) items.push({ label: 'colorChromeEffectBlue', value: photo.colorChromeEffectBlue, description: getDescription('ColorChromeEffectBlue') });
    
    if (photo.whiteBalanceShift) items.push({ label: 'whiteBalanceShift', value: photo.whiteBalanceShift, description: getDescription('WBShift') });
    
    return items;
  };

  const handleToggleFavorite = async () => {
    const newVal = !isFavorite;
    setIsFavorite(newVal);
    onUpdatePhoto(photo.id, { isFavorite: newVal });
  };

  const handleToggleHidden = async () => {
    const newVal = !isHidden;
    setIsHidden(newVal);
    onUpdatePhoto(photo.id, { isHidden: newVal });
    if (newVal) onClose();
  };

  const handleAddTag = async (tagName: string) => {
    console.log('[PhotoDetailModal] handleAddTag called with:', tagName);
    const cleanTag = tagName.trim();
    if (!cleanTag) {
      console.log('[PhotoDetailModal] Empty tag, returning');
      return;
    }
    
    const existingTag = photoTags.find(t => t.name.toLowerCase() === cleanTag.toLowerCase());
    if (existingTag) {
      console.log('[PhotoDetailModal] Tag already exists:', existingTag);
      return;
    }

    setNewTag('');
    
    console.log('[PhotoDetailModal] Calling getOrCreateTag for:', cleanTag);
    const tag = await tagService.getOrCreateTag(cleanTag, photo.ownerId);
    console.log('[PhotoDetailModal] getOrCreateTag returned:', tag);
    
    if (tag) {
      console.log('[PhotoDetailModal] Adding tag to photo:', { photoId: photo.id, tagId: tag.id });
      await tagService.addTagToPhoto(photo.id, tag.id);
      setPhotoTags([...photoTags, tag]);
      
      const newTags = [...(photo.tags || []), tag.name];
      onUpdatePhoto(photo.id, { tags: newTags });
      
      if (!allTags.some(t => t.name === cleanTag)) {
        onAddTag(tag);
      }
    }
  };

  const handleRemoveTag = async (tagToRemove: Tag) => {
    await tagService.removeTagFromPhoto(photo.id, tagToRemove.id);
    setPhotoTags(photoTags.filter(t => t.id !== tagToRemove.id));
    
    const newTags = (photo.tags || []).filter(t => t !== tagToRemove.name);
    onUpdatePhoto(photo.id, { tags: newTags });
  };

  const handleDelete = async () => {
    onDeletePhoto(photo.id);
    onClose();
  };

  return (
    <>
      {metadataContextMenu && (
        <div 
          className="fixed inset-0 z-[60]"
          onClick={() => setMetadataContextMenu(null)}
        >
          <div 
            className="absolute bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: metadataContextMenu.x, top: metadataContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full px-4 py-2 text-left text-xs hover:bg-slate-700 text-white"
              onClick={() => {
                openValueMapEditor(metadataContextMenu.label, metadataContextMenu.value);
                setMetadataContextMenu(null);
              }}
            >
              添加值映射
            </button>
            <button
              className="w-full px-4 py-2 text-left text-xs hover:bg-slate-700 text-white"
              onClick={() => {
                navigator.clipboard.writeText(metadataContextMenu.value);
                setMetadataContextMenu(null);
              }}
            >
              复制值
            </button>
          </div>
        </div>
      )}
      
      {showQuickValueMapModal && quickValueMapField && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-[720px] max-w-[95vw]">
            <h3 className="text-sm font-bold mb-4">添加值映射</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">字段 JSON Path</p>
                <input
                  type="text"
                  value={valueMapJsonPath}
                  onChange={(e) => setValueMapJsonPath(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="rounded-xl border border-slate-600 bg-slate-700/40 p-3">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
                  <span className="text-[10px] text-slate-400">原值</span>
                  <span className="text-[10px] text-slate-400">映射值</span>
                  <span />
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                  {valueMapRows.map((row) => (
                    <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <input
                        type="text"
                        value={row.from}
                        onChange={(e) => setValueMapRows(prev => prev.map(r => r.id === row.id ? { ...r, from: e.target.value } : r))}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={row.to}
                        onChange={(e) => setValueMapRows(prev => prev.map(r => r.id === row.id ? { ...r, to: e.target.value } : r))}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => setValueMapRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== row.id))}
                        className="px-2 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setValueMapRows(prev => [...prev, createValueMapRow()])}
                  className="mt-3 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-[10px] font-bold hover:bg-blue-500/20"
                >
                  添加映射行
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveQuickValueMap}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setShowQuickValueMapModal(false);
                  setQuickValueMapField(null);
                  setValueMapJsonPath('');
                  setValueMapRows([]);
                }}
                className="px-4 py-2 bg-slate-700 rounded-lg text-xs"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="glass w-full max-w-6xl h-full max-h-[90vh] rounded-[2.5rem] overflow-hidden flex flex-col lg:flex-row shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex-1 bg-black/20 flex items-center justify-center relative group">
            <img src={photo.previewUrl} className="max-w-full max-h-full object-contain" alt={photo.fileName} />
            <div className="absolute top-8 right-8 flex flex-col items-end gap-2">
              <button
                onClick={handleToggleFavorite}
                className={isFavorite ? "p-3 bg-red-500/20 hover:bg-red-500/30 backdrop-blur-xl rounded-2xl transition-all border border-red-500/30 text-red-500" : "p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-2xl transition-all border border-white/20 text-white"}
                title="Favorite"
              >
                <Heart className={isFavorite ? "w-5 h-5 fill-red-500" : "w-5 h-5"} />
              </button>
              {photo.fileName.toLowerCase().endsWith('.raf') && (
                <div className="px-4 py-2 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                  {t('photoDetail.rawFile')}
                </div>
              )}
            </div>
            <button 
              onClick={onClose}
              className="absolute top-8 left-8 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-2xl transition-all border border-white/20 text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="w-full lg:w-[28rem] flex flex-col bg-[var(--bg-primary)]/50 backdrop-blur-2xl border-l border-[var(--border-color)]">
            <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-black tracking-tight truncate">{photo.fileName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(photo.dateTime || '').toLocaleString()}</p>
                  <span className="text-slate-600">•</span>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                    <HardDrive className="w-3 h-3" />
                    {folder?.name || t('photoDetail.uncategorized')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onReParse && (
                  <button 
                    onClick={async () => {
                      if (isReParsing) return;
                      setIsReParsing(true);
                      try {
                        await onReParse(photo);
                      } finally {
                        setIsReParsing(false);
                      }
                    }}
                    disabled={isReParsing}
                    className="p-2.5 bg-slate-500/5 hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 rounded-xl transition-all border border-transparent hover:border-blue-500/20 disabled:opacity-50"
                    title="重新解析"
                  >
                    <RefreshCw className={`w-5 h-5 ${isReParsing ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <button 
                  onClick={onExport}
                  className="p-2.5 bg-slate-500/5 hover:bg-orange-500/10 text-slate-400 hover:text-orange-500 rounded-xl transition-all border border-transparent hover:border-orange-500/20"
                  title={t('photoDetail.exportRecipe')}
                >
                  <Share2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2.5 bg-slate-500/5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                  title={t('photoDetail.deletePhoto')}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="flex items-center gap-1 p-1 bg-slate-500/5 rounded-xl">
                <button
                  onClick={() => setActiveDetailTab('detail')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    activeDetailTab === 'detail' ? "bg-blue-500 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  详情
                </button>
                <button
                  onClick={() => setActiveDetailTab('info')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    activeDetailTab === 'info' ? "bg-blue-500 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  元数据
                </button>
                <button
                  onClick={() => setActiveDetailTab('tags')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    activeDetailTab === 'tags' ? "bg-blue-500 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  标签
                </button>
              </div>

              {activeDetailTab === 'detail' && (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t('photoDetail.exifMetadata')}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-500/5 p-3 rounded-xl border border-[var(--border-color)]">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">相机</p>
                        <p className="text-[10px] font-bold truncate" title={cameraModel}>{cameraModel || '-'}</p>
                      </div>
                      <div className="bg-slate-500/5 p-3 rounded-xl border border-[var(--border-color)]">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">镜头、</p>
                        <p className="text-[10px] font-bold truncate" title={lensModel}>{lensModel || '-'}</p>
                      </div>
                      <div className="bg-slate-500/5 p-3 rounded-xl border border-[var(--border-color)]">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">光圈</p>
                        <p className="text-[10px] font-bold">{aperture ? `f/${aperture}` : '-'}</p>
                      </div>
                      <div className="bg-slate-500/5 p-3 rounded-xl border border-[var(--border-color)]">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">快门</p>
                        <p className="text-[10px] font-bold">{shutterSpeed || '-'}</p>
                      </div>
                      <div className="bg-slate-500/5 p-3 rounded-xl border border-[var(--border-color)]">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">ISO</p>
                        <p className="text-[10px] font-bold">{iso || '-'}</p>
                      </div>
                      <div className="bg-slate-500/5 p-3 rounded-xl border border-[var(--border-color)]">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">焦距</p>
                        <p className="text-[10px] font-bold">{focalLength ? `${focalLength}mm` : '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t('photoDetail.filmSettings')}</h3>
                      <div className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-[8px] font-black uppercase tracking-widest border border-blue-500/20">
                        {getMetadataValue('filmSimulation') || getMetadataValue('FilmMode') || photo.filmMode || 'Provia'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {photoDetailConfig.includes('whiteBalance') && (
                        renderMappableCard('whiteBalance', getConfiguredFieldLabel('whiteBalance', t('recipe.whiteBalance')), getMetadataValue('whiteBalance') || getMetadataValue('WhiteBalance') || photo.whiteBalance)
                      )}
                      {photoDetailConfig.includes('dynamicRange') && (
                        renderMappableCard('dynamicRange', getConfiguredFieldLabel('dynamicRange', t('recipe.dynamicRange')), getMetadataValue('dynamicRange') || getMetadataValue('DynamicRange') || photo.dynamicRange)
                      )}
                      {photoDetailConfig.includes('highlightTone') && (
                        renderMappableCard('highlightTone', getConfiguredFieldLabel('highlightTone', t('recipe.highlight')), getMetadataValue('highlightTone') || getMetadataValue('Highlight') || photo.highlightTone)
                      )}
                      {photoDetailConfig.includes('shadowTone') && (
                        renderMappableCard('shadowTone', getConfiguredFieldLabel('shadowTone', t('recipe.shadow')), getMetadataValue('shadowTone') || getMetadataValue('Shadow') || photo.shadowTone)
                      )}
                      {photoDetailConfig.includes('saturation') && (
                        renderMappableCard('saturation', getConfiguredFieldLabel('saturation', t('recipe.color')), getMetadataValue('saturation') || getMetadataValue('Saturation') || photo.saturation)
                      )}
                      {photoDetailConfig.includes('sharpness') && (
                        renderMappableCard('sharpness', getConfiguredFieldLabel('sharpness', t('recipe.sharpness')), getMetadataValue('sharpness') || getMetadataValue('Sharpness') || photo.sharpness)
                      )}
                      {photoDetailConfig.includes('noiseReduction') && (
                        renderMappableCard('noiseReduction', getConfiguredFieldLabel('noiseReduction', t('recipe.noiseReduction')), getMetadataValue('noiseReduction') || getMetadataValue('NoiseReduction') || photo.noiseReduction)
                      )}
                      {photoDetailConfig.includes('clarity') && (
                        renderMappableCard('clarity', getConfiguredFieldLabel('clarity', t('recipe.clarity')), getMetadataValue('clarity') || getMetadataValue('Clarity') || photo.clarity)
                      )}
                      {photoDetailConfig.includes('grainEffect') && (
                        <>
                          {renderMappableCard('grainEffect', getConfiguredFieldLabel('grainEffect', t('recipe.grainRoughness')), getMetadataValue('grainEffect') || getMetadataValue('GrainEffect') || grainRoughness)}
                          {renderMappableCard('grainEffect', getConfiguredFieldLabel('grainEffect', t('recipe.grainSize')), grainSize)}
                        </>
                      )}
                      {photoDetailConfig.includes('colorChromeEffect') && (
                        renderMappableCard('colorChromeEffect', getConfiguredFieldLabel('colorChromeEffect', t('recipe.colorChrome')), getMetadataValue('colorChromeEffect') || getMetadataValue('ColorChromeEffect') || photo.colorChromeEffect)
                      )}
                      {photoDetailConfig.includes('colorChromeEffectBlue') && (
                        renderMappableCard('colorChromeEffectBlue', getConfiguredFieldLabel('colorChromeEffectBlue', t('recipe.fxBlue')), getMetadataValue('colorChromeEffectBlue') || getMetadataValue('ColorChromeEffectBlue') || photo.colorChromeEffectBlue)
                      )}
                      {photoDetailConfig.includes('whiteBalanceShiftR') && (
                        renderMappableCard('whiteBalanceShiftR', getConfiguredFieldLabel('whiteBalanceShiftR', t('recipe.wbRed')), wbRed)
                      )}
                      {photoDetailConfig.includes('whiteBalanceShiftB') && (
                        renderMappableCard('whiteBalanceShiftB', getConfiguredFieldLabel('whiteBalanceShiftB', t('recipe.wbBlue')), wbBlue)
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeDetailTab === 'info' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">元数据</h3>
                  </div>
                  <input
                    type="text"
                    placeholder="搜索元数据..."
                    className="w-full px-3 py-2 text-xs bg-slate-500/10 border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onChange={(e) => setMetadataSearch(e.target.value)}
                    value={metadataSearch}
                  />
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {getAllMetadataItems()
                      .filter(item => {
                        if (!metadataSearch) return true;
                        const search = metadataSearch.toLowerCase();
                        return item.label.toLowerCase().includes(search) || 
                               item.value.toLowerCase().includes(search) ||
                               item.description.toLowerCase().includes(search);
                      })
                      .map((item, index) => (
                      <div 
                        key={index} 
                        className="flex flex-col gap-1 py-2 px-3 bg-slate-500/5 rounded-lg cursor-pointer hover:bg-blue-500/10"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (item.value && item.value !== '-') {
                            setMetadataContextMenu({ x: e.clientX, y: e.clientY, label: item.label, value: item.value });
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-blue-500 whitespace-nowrap">{item.label}</span>
                          {item.description && (
                            <span className="text-[9px] text-slate-400">({item.description})</span>
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 break-all">{item.value}</span>
                      </div>
                    ))}
                    {getAllMetadataItems()
                      .filter(item => {
                        if (!metadataSearch) return true;
                        const search = metadataSearch.toLowerCase();
                        return item.label.toLowerCase().includes(search) || 
                               item.value.toLowerCase().includes(search) ||
                               item.description.toLowerCase().includes(search);
                      }).length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-8">{metadataSearch ? '无匹配结果' : '暂无元数据'}</p>
                    )}
                  </div>
                </div>
              )}

              {activeDetailTab === 'tags' && (
                <div className="space-y-4">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t('photoDetail.tags')}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {photoTags.map(tag => (
                      <span 
                        key={tag.id} 
                        className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-500/20 group/tag"
                        style={{ borderColor: tag.color ? `${tag.color}33` : undefined, color: tag.color || undefined }}
                      >
                        {tag.name}
                        <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 transition-colors">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="+"
                        className="w-12 bg-slate-500/5 border border-[var(--border-color)] rounded-lg px-2 py-1 text-[9px] font-bold focus:outline-none focus:w-24 transition-all"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          console.log('[PhotoDetailModal] Key pressed:', e.key, 'value:', newTag);
                          if (e.key === 'Enter') {
                            console.log('[PhotoDetailModal] Enter pressed, calling handleAddTag');
                            handleAddTag(newTag);
                          }
                        }}
                      />
                      {newTag && suggestions.length > 0 && (
                        <div className="absolute bottom-full mb-2 left-0 w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-10">
                          {suggestions.map(tag => (
                            <button
                              key={tag.id}
                              onClick={() => handleAddTag(tag.name)}
                              className="w-full px-4 py-2 text-left text-[10px] font-bold hover:bg-blue-500/10 hover:text-blue-500 transition-colors flex items-center gap-2"
                            >
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {!newTag && allTags.length > 0 && allTags.some(t => !photoTags.some(pt => pt.name === t.name)) && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest w-full mb-1">{t('photoDetail.availableTags')}</span>
                      {allTags.filter(t => !photoTags.some(pt => pt.name === t.name)).slice(0, 10).map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => handleAddTag(tag.name)}
                          className="px-2 py-1 bg-slate-500/5 hover:bg-slate-500/10 text-slate-400 hover:text-blue-500 rounded-lg text-[8px] font-black uppercase tracking-widest border border-transparent hover:border-blue-500/20 transition-all"
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="p-4 border-t border-[var(--border-color)] flex flex-col gap-3">
              <div className="flex gap-4">
                <button 
                  onClick={() => window.electronAPI?.showInFolder?.(photo.filePath)}
                  className="flex-1 py-2.5 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-[var(--border-color)]"
                >
                  <Navigation className="w-4 h-4" />
                  {t('photoDetail.locateFile')}
                </button>
                <button 
                  onClick={() => window.electronAPI?.openFolderPath?.(photo.filePath)}
                  className="flex-1 py-2.5 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-[var(--border-color)]"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('photoDetail.openOriginal')}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <ConfirmModal 
            title={t('photoDetail.deleteConfirmTitle')}
            message={t('photoDetail.deleteConfirmMessage')}
            confirmLabel={t('recipe.delete')}
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
            variant="danger"
          />
        )}
      </AnimatePresence>
    </>
  );
}
