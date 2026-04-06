import React, { useState, useCallback, useEffect } from 'react';
import { Upload, X, ChevronDown, Copy, RefreshCw, Check, ArrowLeft, Plus, Trash2, Eye, Image, FileText, Settings, BookOpen, Save, Download } from 'lucide-react';
import { MetadataParser, MetadataFieldConfig, MetadataDisplayConfig, ParsedMetadata, DisplayType } from '../../utils/metadataParser';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../hooks/useLanguage';
import { DocumentationModal } from '../modals/DocumentationModal';
import defaultConfig from '../../constants/metadata-default-config.json';

interface MetadataParserViewProps {
  onBack?: () => void;
  onFieldsChange?: (fields: MetadataFieldConfig[]) => void;
  onDisplayConfigChange?: (config: Record<DisplayType, string[]>) => void;
}

const DEFAULT_FIELDS: MetadataFieldConfig[] = [
  { key: 'filmSimulation', label: '胶片模拟', labelKey: 'metadata.filmSimulation', jsonPath: 'FilmMode', isEnabled: true, isCustom: false },
  { key: 'whiteBalance', label: '白平衡', labelKey: 'metadata.whiteBalance', jsonPath: 'WhiteBalance', isEnabled: true, isCustom: false, valueMap: {
    'Auto (ambiance priority)': '自动',
    'Auto (white priority)': '自动(W)',
    'Daylight': '日光',
    'Cloudy': '阴天',
    'Shade': '阴影',
    'Fluorescent (Daylight)': '荧光灯(日光)',
    'Fluorescent (Warm White)': '荧光灯(暖白)',
    'Fluorescent (Cool White)': '荧光灯(冷白)',
    'Incandescent': '白炽灯',
    'Kelvin': '开尔文'
  }},
  { key: 'whiteBalanceShiftR', label: '白平衡红色偏移', labelKey: 'metadata.whiteBalanceShiftR', jsonPath: 'WBShiftR', isEnabled: false, isCustom: false },
  { key: 'whiteBalanceShiftB', label: '白平衡蓝色偏移', labelKey: 'metadata.whiteBalanceShiftB', jsonPath: 'WBShiftB', isEnabled: false, isCustom: false },
  { key: 'whiteBalanceShift', label: '白平衡偏移', labelKey: 'metadata.whiteBalanceShift', jsonPath: 'WBShift', isEnabled: true, isCustom: false, isCombined: true, combinedFields: ['whiteBalanceShiftR', 'whiteBalanceShiftB'] },
  { key: 'dynamicRange', label: '动态范围', labelKey: 'metadata.dynamicRange', jsonPath: 'DynamicRange', isEnabled: true, isCustom: false },
  { key: 'sharpness', label: '锐度', labelKey: 'metadata.sharpness', jsonPath: 'Sharpness', isEnabled: true, isCustom: false },
  { key: 'saturation', label: '饱和度', labelKey: 'metadata.saturation', jsonPath: 'Saturation', isEnabled: true, isCustom: false },
  { key: 'contrast', label: '对比度', labelKey: 'metadata.contrast', jsonPath: 'Contrast', isEnabled: true, isCustom: false },
  { key: 'highlightTone', label: '高光', labelKey: 'metadata.highlightTone', jsonPath: 'Highlight', isEnabled: true, isCustom: false },
  { key: 'shadowTone', label: '阴影', labelKey: 'metadata.shadowTone', jsonPath: 'Shadow', isEnabled: true, isCustom: false },
  { key: 'noiseReduction', label: '降噪', labelKey: 'metadata.noiseReduction', jsonPath: 'NoiseReduction', isEnabled: true, isCustom: false },
  { key: 'clarity', label: '清晰度', labelKey: 'metadata.clarity', jsonPath: 'Clarity', isEnabled: true, isCustom: false },
  { key: 'grainEffect', label: '颗粒效果', labelKey: 'metadata.grainEffect', jsonPath: 'GrainEffect', isEnabled: true, isCustom: false },
  { key: 'colorChromeEffect', label: '色彩效果', labelKey: 'metadata.colorChromeEffect', jsonPath: 'ColorChromeEffect', isEnabled: true, isCustom: false },
  { key: 'colorChromeEffectBlue', label: '蓝色色彩效果', labelKey: 'metadata.colorChromeEffectBlue', jsonPath: 'ColorChromeEffectBlue', isEnabled: true, isCustom: false },
];

const DEFAULT_DISPLAY_CONFIG: Record<DisplayType, string[]> = {
  photoList: ['filmSimulation', 'whiteBalance'],
  photoDetail: ['filmSimulation', 'whiteBalance', 'dynamicRange', 'sharpness', 'saturation', 'contrast', 'highlightTone', 'shadowTone', 'noiseReduction', 'clarity', 'grainEffect', 'colorChromeEffect', 'colorChromeEffectBlue'],
  recipeList: ['filmSimulation', 'whiteBalance', 'dynamicRange'],
  recipeDetail: ['filmSimulation', 'whiteBalance', 'dynamicRange', 'sharpness', 'saturation', 'contrast', 'highlightTone', 'shadowTone', 'noiseReduction', 'clarity', 'grainEffect', 'colorChromeEffect', 'colorChromeEffectBlue', 'whiteBalanceShift'],
};

const STORAGE_KEY = 'fuji_metadata_fields';
const DISPLAY_CONFIG_KEY = 'fuji_metadata_display_config';
type ValueMapRow = { id: string; from: string; to: string };

async function loadFieldsFromDatabase(): Promise<MetadataFieldConfig[]> {
  try {
    if (window.electronAPI?.getMetadataFields) {
      const dbFields = await window.electronAPI.getMetadataFields();
      if (dbFields && Array.isArray(dbFields) && dbFields.length > 0) {
        const defaultKeys = new Set(DEFAULT_FIELDS.map(f => f.key));
        return [
          ...DEFAULT_FIELDS.map(df => {
            const existing = dbFields.find((sf: MetadataFieldConfig) => sf.key === df.key);
            return existing ? { ...df, ...existing } : df;
          }),
          ...dbFields.filter((sf: MetadataFieldConfig) => !defaultKeys.has(sf.key))
        ];
      }
    }
  } catch (error) {
    console.error('[MetadataParserView] Error loading fields from database:', error);
  }
  // 如果数据库为空，使用默认配置
  if (defaultConfig.fields && Array.isArray(defaultConfig.fields)) {
    return defaultConfig.fields;
  }
  return null;
}

function loadFieldsFromStorage(): MetadataFieldConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const defaultKeys = new Set(DEFAULT_FIELDS.map(f => f.key));
        return [
          ...DEFAULT_FIELDS.map(df => {
            const existing = parsed.find((sf: MetadataFieldConfig) => sf.key === df.key);
            return existing ? { ...df, ...existing } : df;
          }),
          ...parsed.filter((sf: MetadataFieldConfig) => !defaultKeys.has(sf.key))
        ];
      }
    }
  } catch (error) {
    console.error('[MetadataParserView] Error loading fields:', error);
  }
  return [...DEFAULT_FIELDS];
}

async function saveFieldsToDatabase(fields: MetadataFieldConfig[]) {
  try {
    if (window.electronAPI?.saveMetadataFields) {
      const result = await window.electronAPI.saveMetadataFields(fields);
      console.log('[MetadataParserView] Save result:', result);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
      return result;
    } else {
      console.warn('[MetadataParserView] saveMetadataFields API not available');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
      return false;
    }
  } catch (error) {
    console.error('[MetadataParserView] Error saving fields to database:', error);
    return false;
  }
}

function loadDisplayConfigFromStorage(): Record<DisplayType, string[]> {
  try {
    const stored = localStorage.getItem(DISPLAY_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[MetadataParserView] Error loading display config:', error);
  }
  return { ...DEFAULT_DISPLAY_CONFIG };
}

function saveDisplayConfigToStorage(config: Record<DisplayType, string[]>) {
  try {
    localStorage.setItem(DISPLAY_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('[MetadataParserView] Error saving display config:', error);
  }
}

function getDisplayTypeLabel(type: DisplayType, t: (key: string) => string): string {
  const labels: Record<DisplayType, string> = {
    photoList: t('metadata.photoList') || '照片列表',
    photoDetail: t('metadata.photoDetail') || '照片详情',
    recipeList: t('metadata.recipeList') || '配方列表',
    recipeDetail: t('metadata.recipeDetail') || '配方详情',
  };
  return labels[type];
}

export function MetadataParserView({ onBack, onFieldsChange, onDisplayConfigChange }: MetadataParserViewProps) {
  const { t } = useLanguage();
  const [metadata, setMetadata] = useState<ParsedMetadata | null>(null);
  const [fields, setFields] = useState<MetadataFieldConfig[]>([]);
  const [displayConfig, setDisplayConfig] = useState<Record<DisplayType, string[]>>(loadDisplayConfigFromStorage);
  const [fieldsLoaded, setFieldsLoaded] = useState(false);
  const [showJsonPanel, setShowJsonPanel] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempField, setTempField] = useState<Partial<MetadataFieldConfig>>({});
  const [showCopied, setShowCopied] = useState(false);
  const [extractedFields, setExtractedFields] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [activeTab, setActiveTab] = useState<'parse' | 'photoList' | 'photoDetail' | 'recipeList' | 'recipeDetail'>('parse');
  const [displayEditing, setDisplayEditing] = useState<DisplayType | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [hasDisplayChanges, setHasDisplayChanges] = useState(false);
  const [editingMode, setEditingMode] = useState<'jsonPath' | 'combined'>('jsonPath');
  const [showValueMapModal, setShowValueMapModal] = useState(false);
  const [valueMapEditor, setValueMapEditor] = useState<{
    fieldKey?: string;
    jsonPath: string;
    displayName: string;
    rows: ValueMapRow[];
  } | null>(null);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fieldKey: string; fieldValue: string } | null>(null);

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

  const persistFields = (newFields: MetadataFieldConfig[]) => {
    setFields(newFields);
    saveFieldsToDatabase(newFields);
    onFieldsChange?.(newFields);
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

  const handleDragStart = (e: React.DragEvent, key: string) => {
    setDraggedKey(key);
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setDraggedKey(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const key = e.dataTransfer.getData('text/plain');
    if (key && editingField) {
      setTempField(prev => ({ ...prev, jsonPath: key }));
    }
    setDraggedKey(null);
  };

  useEffect(() => {
    const initFields = async () => {
      const dbFields = await loadFieldsFromDatabase();
      if (dbFields) {
        setFields(dbFields);
        onFieldsChange?.(dbFields);
      } else {
        const localFields = loadFieldsFromStorage();
        setFields(localFields);
        onFieldsChange?.(localFields);
        // 如果本地也没有，使用默认配置并保存到数据库
        if (defaultConfig.fields && Array.isArray(defaultConfig.fields)) {
          await saveFieldsToDatabase(defaultConfig.fields);
        }
      }
      setFieldsLoaded(true);
    };
    initFields();
  }, []);

  const handleSaveDisplay = () => {
    saveDisplayConfigToStorage(displayConfig);
    onDisplayConfigChange?.(displayConfig);
    setHasDisplayChanges(false);
  };

  const handleFileUpload = useCallback(async () => {
    if (!window.electronAPI?.pickFiles) {
      console.error('pickFiles API not available');
      return;
    }

    try {
      const picked = await window.electronAPI.pickFiles();
      if (!picked || picked.length === 0) return;

      const filePath = picked[0];
      const parsed = await MetadataParser.parseFile(filePath);
      setMetadata(parsed);
      setShowJsonPanel(true);

      const extracted = MetadataParser.extractFields(parsed, fields);
      setExtractedFields(extracted);
    } catch (error) {
      console.error('Error parsing file:', error);
    }
  }, [fields]);

  const handleFieldUpdate = (key: string, updates: Partial<MetadataFieldConfig>) => {
    console.log('[MetadataParserView] handleFieldUpdate called for:', key, updates);
    const newFields = fields.map(f => f.key === key ? { ...f, ...updates } : f);
    persistFields(newFields);
    console.log('[MetadataParserView] Saving fields to database, count:', newFields.length);
  };

  const handleSaveField = () => {
    if (editingField) {
      const updates: Partial<MetadataFieldConfig> = {
        label: tempField.label,
        jsonPath: tempField.jsonPath,
        combinedFields: tempField.combinedFields,
        isCombined: tempField.isCombined || (tempField.combinedFields && tempField.combinedFields.length > 0)
      };
      handleFieldUpdate(editingField, updates);
    }
    setEditingField(null);
    setTempField({});
  };

  const openValueMapEditor = (target: { fieldKey?: string; jsonPath: string; displayName: string; valueMap?: Record<string, string> }, preferredFrom?: string) => {
    setValueMapEditor({
      fieldKey: target.fieldKey,
      jsonPath: target.jsonPath,
      displayName: target.displayName,
      rows: valueMapToRows(target.valueMap, preferredFrom)
    });
    setShowValueMapModal(true);
  };

  const handleSaveValueMap = () => {
    if (!valueMapEditor) return;
    const jsonPath = valueMapEditor.jsonPath.trim();
    if (!jsonPath) {
      alert('请先填写字段 JSON Path');
      return;
    }

    const mapped = rowsToValueMap(valueMapEditor.rows);
    const existingByKey = valueMapEditor.fieldKey ? fields.find(f => f.key === valueMapEditor.fieldKey) : null;
    const existingByPath = fields.find(f => f.jsonPath === jsonPath);
    const existingField = existingByKey || existingByPath;

    let newFields: MetadataFieldConfig[];
    if (existingField) {
      newFields = fields.map(field => {
        if (field.key !== existingField.key) return field;
        return {
          ...field,
          jsonPath,
          valueMap: mapped
        };
      });
    } else {
      const key = buildFieldKeyFromJsonPath(jsonPath, fields);
      const newField: MetadataFieldConfig = {
        key,
        label: valueMapEditor.displayName || jsonPath,
        jsonPath,
        isEnabled: false,
        isCustom: true,
        valueMap: mapped
      };
      newFields = [...fields, newField];
    }

    persistFields(newFields);
    setShowValueMapModal(false);
    setValueMapEditor(null);
  };

  const handleAddField = () => {
    if (!newFieldKey || !newFieldLabel) return;
    
    const key = newFieldKey.toLowerCase().replace(/\s+/g, '');
    if (fields.some(f => f.key === key)) {
      alert('字段 key 已存在');
      return;
    }

    const newFields = [...fields, {
      key,
      label: newFieldLabel,
      jsonPath: '',
      isEnabled: true,
      isCustom: true
    }];
    persistFields(newFields);
    
    setNewFieldKey('');
    setNewFieldLabel('');
    setShowAddModal(false);
  };

  const handleDeleteField = (key: string) => {
    const newFields = fields.filter(f => f.key !== key);
    persistFields(newFields);
    
    const newConfig = { ...displayConfig };
    Object.keys(newConfig).forEach(k => {
      newConfig[k as DisplayType] = newConfig[k as DisplayType].filter(fk => fk !== key);
    });
    setDisplayConfig(newConfig);
    
    saveDisplayConfigToStorage(newConfig);
    onDisplayConfigChange?.(newConfig);
  };

  const handleResetFields = () => {
    persistFields([...DEFAULT_FIELDS]);
    setExtractedFields({});
  };

  const handleResetDisplayConfig = () => {
    const newConfig = { ...DEFAULT_DISPLAY_CONFIG };
    setDisplayConfig(newConfig);
    setHasDisplayChanges(true);
  };

  const handleCopyJson = () => {
    if (metadata?.raw) {
      navigator.clipboard.writeText(JSON.stringify(metadata.raw, null, 2));
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  const handleDisplayFieldToggle = (type: DisplayType, fieldKey: string) => {
    const newConfig = { ...displayConfig };
    const current = newConfig[type];
    if (current.includes(fieldKey)) {
      newConfig[type] = current.filter(k => k !== fieldKey);
    } else {
      newConfig[type] = [...current, fieldKey];
    }
    setDisplayConfig(newConfig);
    setHasDisplayChanges(true);
  };

  const handleDisplayFieldOrder = (type: DisplayType, fieldKey: string, direction: 'up' | 'down') => {
    const newConfig = { ...displayConfig };
    const current = [...newConfig[type]];
    const index = current.indexOf(fieldKey);
    if (direction === 'up' && index > 0) {
      [current[index - 1], current[index]] = [current[index], current[index - 1]];
    } else if (direction === 'down' && index < current.length - 1) {
      [current[index], current[index + 1]] = [current[index + 1], current[index]];
    }
    newConfig[type] = current;
    setDisplayConfig(newConfig);
    setHasDisplayChanges(true);
  };

  const rawKeys = metadata ? MetadataParser.getAllRawKeys(metadata) : [];
  const enabledFields = fields.filter(f => f.isEnabled);
  const rawKeySet = new Set(rawKeys);
  const existingJsonPathSet = new Set(fields.map(field => field.jsonPath).filter(Boolean));
  const extraRawTargets = Array.from(rawKeySet)
    .filter(path => !existingJsonPathSet.has(path))
    .map(path => ({
      id: `raw:${path}`,
      fieldKey: undefined as string | undefined,
      jsonPath: path,
      displayName: path,
      valueMap: undefined as Record<string, string> | undefined
    }));
  const valueMapTargets = [
    ...fields.map(field => ({
      id: `field:${field.key}`,
      fieldKey: field.key,
      jsonPath: field.jsonPath || '',
      displayName: field.labelKey && t(field.labelKey) !== field.labelKey ? t(field.labelKey) : field.label,
      valueMap: field.valueMap
    })),
    ...extraRawTargets
  ];
  const fieldsWithValueMap = valueMapTargets.filter(target => target.valueMap && Object.keys(target.valueMap).length > 0);

  const getFieldLabel = (field: MetadataFieldConfig): string => {
    if (field.label && field.label.trim()) {
      return field.label;
    }
    if (field.labelKey && t(field.labelKey) !== field.labelKey) {
      return t(field.labelKey);
    }
    return field.key;
  };

  const tabs = [
    { key: 'parse', label: t('metadata.parseConfig') || '解析配置', icon: Settings },
    { key: 'photoList', label: t('metadata.photoList') || '照片列表', icon: Image },
    { key: 'photoDetail', label: t('metadata.photoDetail') || '照片详情', icon: Eye },
    { key: 'recipeList', label: t('metadata.recipeList') || '配方列表', icon: FileText },
    { key: 'recipeDetail', label: t('metadata.recipeDetail') || '配方详情', icon: FileText },
  ] as const;

  const renderParseConfig = () => (
    <div className="flex-1 min-h-0 flex gap-6">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-shrink-0">
          {!metadata ? (
            <div className="border-2 border-dashed border-[var(--border-color)] rounded-3xl p-12 flex flex-col items-center justify-center text-center hover:border-blue-500/30 hover:bg-blue-500/5 transition-all cursor-pointer" onClick={handleFileUpload}>
              <Upload className="w-12 h-12 text-slate-400 mb-4" />
              <p className="text-lg font-bold mb-2">点击或拖拽上传图片</p>
              <p className="text-xs text-slate-400">支持 JPG, PNG, HEIC, RAF 等格式</p>
            </div>
          ) : (
            <div className="border border-[var(--border-color)] rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold">已解析文件</p>
                <button
                  onClick={() => { setMetadata(null); setShowJsonPanel(false); }}
                  className="p-1.5 rounded-lg hover:bg-slate-500/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <p className="text-xs font-bold text-green-600 mb-3">提取的胶片模拟参数</p>
                <div className="grid grid-cols-2 gap-2">
                  {enabledFields.map((field) => {
                    const value = extractedFields[field.key] || '-';
                    return (
                      <div 
                        key={field.key} 
                        className="bg-white/50 dark:bg-black/20 rounded-lg p-2 cursor-pointer hover:bg-blue-500/10"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (value && value !== '-') {
                            setContextMenu({ x: e.clientX, y: e.clientY, fieldKey: field.key, fieldValue: value });
                          }
                        }}
                      >
                        <span className="text-[8px] uppercase text-slate-400 block">{getFieldLabel(field)}</span>
                        <span className="text-xs font-bold truncate">{value}</span>
                      </div>
                    );
                  })}
                  {enabledFields.length === 0 && (
                    <p className="text-xs text-slate-400 col-span-2">暂无启用的字段</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto mt-6 custom-scrollbar">
          <div className="bg-slate-500/5 rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-4">{t('metadata.fieldMapping') || '字段映射配置'}</h3>
            {!fieldsLoaded ? (
              <div className="text-center py-8 text-slate-400">加载中...</div>
            ) : (
            <div className="space-y-2">
              {fields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <div className="w-6 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={field.isEnabled}
                      onChange={(e) => handleFieldUpdate(field.key, { isEnabled: e.target.checked })}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                  </div>
                  <div className="w-28 flex-shrink-0 flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-400">{getFieldLabel(field)}</span>
                    {field.isCustom && (
                      <span className="text-[8px] px-1 py-0.5 bg-purple-500/20 text-purple-500 rounded">自定义</span>
                    )}
                  </div>
                  <div className="flex-1 relative">
                    {editingField === field.key ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 bg-slate-500/10 rounded-lg p-1">
                          <button
                            onClick={() => setEditingMode('jsonPath')}
                            className={cn("flex-1 px-2 py-1.5 rounded-md text-xs font-bold transition-all", editingMode === 'jsonPath' ? "bg-white dark:bg-slate-800 shadow-sm" : "text-slate-400")}
                          >
                            JSON路径
                          </button>
                          <button
                            onClick={() => setEditingMode('combined')}
                            className={cn("flex-1 px-2 py-1.5 rounded-md text-xs font-bold transition-all", editingMode === 'combined' ? "bg-white dark:bg-slate-800 shadow-sm" : "text-slate-400")}
                          >
                            组合
                          </button>
                        </div>
                        
                        {editingMode === 'jsonPath' && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={tempField.label || ''}
                              onChange={(e) => setTempField({ ...tempField, label: e.target.value })}
                              placeholder="字段显示名称"
                              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-[var(--border-color)] text-xs focus:outline-none focus:border-blue-500"
                            />
                            <div 
                              className={cn(
                                "flex items-center gap-2 rounded-lg border-2 transition-all",
                                draggedKey ? "border-blue-500 border-dashed bg-blue-500/5" : "border-transparent"
                              )}
                              onDragOver={handleDragOver}
                              onDrop={handleDrop}
                            >
                              <input
                                type="text"
                                value={tempField.jsonPath || ''}
                                onChange={(e) => setTempField({ ...tempField, jsonPath: e.target.value })}
                                placeholder={draggedKey ? "拖放字段到此处" : "输入JSON路径，如: WhiteBalance"}
                                className={cn(
                                  "flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border text-xs font-mono focus:outline-none transition-all",
                                  draggedKey 
                                    ? "border-blue-500 bg-blue-500/5" 
                                    : "border-[var(--border-color)] focus:border-blue-500"
                                )}
                                autoFocus
                              />
                              <button onClick={handleSaveField} className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => { setEditingField(null); setTempField({}); }} className="p-2 bg-slate-500/10 rounded-lg">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        {editingMode === 'combined' && (
                          <div className="space-y-2">
                            <div className="text-xs text-slate-400 mb-1">选择要组合的字段（子字段需先单独配置 JSON 路径）</div>
                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                              {fields.filter(f => f.key !== field.key).map(subField => (
                                <label
                                  key={subField.key}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-1 rounded-md text-xs cursor-pointer transition-all",
                                    tempField.combinedFields?.includes(subField.key) 
                                      ? "bg-blue-500/20 text-blue-500 border border-blue-500/30" 
                                      : "bg-slate-500/5 text-slate-400 border border-transparent"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={tempField.combinedFields?.includes(subField.key) || false}
                                    onChange={(e) => {
                                      const current = tempField.combinedFields || [];
                                      if (e.target.checked) {
                                        setTempField({ ...tempField, combinedFields: [...current, subField.key] });
                                      } else {
                                        setTempField({ ...tempField, combinedFields: current.filter((k: string) => k !== subField.key) });
                                      }
                                    }}
                                    className="hidden"
                                  />
                                  {getFieldLabel(subField)}
                                </label>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={handleSaveField} className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs font-bold">
                                保存组合
                              </button>
                              <button onClick={() => { setEditingField(null); setTempField({}); }} className="px-3 py-2 bg-slate-500/10 rounded-lg">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { 
                            setEditingField(field.key); 
                            setTempField({ 
                              jsonPath: field.jsonPath, 
                              label: field.label,
                              combinedFields: field.combinedFields,
                              isCombined: field.isCombined
                            }); 
                          }}
                          className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-[var(--border-color)] hover:border-blue-500/30"
                        >
                          <span className="text-xs font-mono truncate">{field.jsonPath || '点击配置'}</span>
                          <div className="flex items-center gap-1">
                            {field.isCombined && (
                              <span className="text-[8px] px-1.5 py-0.5 bg-purple-500/20 text-purple-500 rounded">组合</span>
                            )}
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          </div>
                        </button>
                        {field.isCustom && (
                          <button onClick={() => handleDeleteField(field.key)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>

          <div className="bg-slate-500/5 rounded-2xl p-4 mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">值映射列表</h3>
              <span className="text-[10px] text-slate-400">
                已配置 {fieldsWithValueMap.length}/{valueMapTargets.length}
              </span>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {valueMapTargets.map((target) => {
                const hasMap = !!target.valueMap && Object.keys(target.valueMap).length > 0;
                const hasMappedField = !!target.fieldKey;
                return (
                  <div key={`valuemap-${target.id}`} className="p-3 rounded-xl bg-white/50 dark:bg-black/20 border border-transparent hover:border-slate-500/20">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold truncate">{target.displayName}</span>
                        {!hasMappedField && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500">仅JSON路径</span>
                        )}
                        <span className={cn(
                          "text-[8px] px-1.5 py-0.5 rounded",
                          hasMap ? "bg-green-500/20 text-green-500" : "bg-slate-500/10 text-slate-400"
                        )}>
                          {hasMap ? `${Object.keys(target.valueMap || {}).length} 条` : '未配置'}
                        </span>
                      </div>
                      <button
                        onClick={() => openValueMapEditor(target)}
                        className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                      >
                        编辑映射
                      </button>
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-slate-400 truncate">
                      {target.jsonPath || '未设置 JSON Path'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showJsonPanel && (
        <div className="w-[400px] flex-shrink-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Raw JSON</h3>
            <button onClick={handleCopyJson} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-500/5 border text-xs">
              {showCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {showCopied ? '已复制' : '复制'}
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto bg-slate-900 rounded-2xl p-4">
            <pre className="text-[10px] font-mono text-green-400 whitespace-pre-wrap">
              {metadata?.raw ? JSON.stringify(metadata.raw, null, 2) : '暂无数据'}
            </pre>
          </div>
          {rawKeys.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold mb-2">可用字段 ({rawKeys.length}) <span className="text-slate-400 font-normal text-[10px]">拖拽到输入框</span></h4>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {rawKeys.slice(0, 50).map((key) => (
                  <button
                    key={key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, key)}
                    onDragEnd={handleDragEnd}
                    onClick={() => editingField && setTempField(prev => ({ ...prev, jsonPath: key }))}
                    className={cn(
                      "px-2 py-1 rounded-md bg-slate-500/10 text-[8px] font-mono hover:bg-blue-500/10 truncate max-w-[150px] cursor-grab active:cursor-grabbing transition-all",
                      draggedKey === key && "opacity-50 scale-95"
                    )}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderDisplayConfig = (type: DisplayType) => (
    <div className="flex-1 overflow-auto custom-scrollbar">
      <div className="bg-slate-500/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold">{getDisplayTypeLabel(type, t)}</h3>
          <button
            onClick={handleResetDisplayConfig}
            className="text-xs text-blue-500 hover:underline"
          >
            {t('metadata.resetToDefault') || '恢复默认'}
          </button>
        </div>
        <div className="space-y-2">
          {enabledFields.map((field, index) => {
            const isSelected = displayConfig[type].includes(field.key);
            return (
              <div
                key={field.key}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all",
                  isSelected ? "bg-blue-500/10 border-blue-500/30" : "bg-white/50 dark:bg-black/20 border-transparent hover:border-slate-500/20"
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleDisplayFieldToggle(type, field.key)}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <span className="flex-1 text-xs font-bold">{getFieldLabel(field)}</span>
                {isSelected && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDisplayFieldOrder(type, field.key, 'up')}
                      disabled={displayConfig[type].indexOf(field.key) === 0}
                      className="p-1 hover:bg-slate-500/10 rounded disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4 rotate-180" />
                    </button>
                    <button
                      onClick={() => handleDisplayFieldOrder(type, field.key, 'down')}
                      disabled={displayConfig[type].indexOf(field.key) === displayConfig[type].length - 1}
                      className="p-1 hover:bg-slate-500/10 rounded disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-4">
          {t('metadata.displayTip') || '勾选要在此页面显示的字段，可拖拽调整顺序'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {contextMenu && (
        <div 
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
        >
          <div 
            className="absolute bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full px-4 py-2 text-left text-xs hover:bg-slate-700 text-white"
              onClick={() => {
                const field = fields.find(f => f.key === contextMenu.fieldKey);
                if (field) {
                  openValueMapEditor(
                    {
                      fieldKey: field.key,
                      jsonPath: field.jsonPath || field.key,
                      displayName: getFieldLabel(field),
                      valueMap: field.valueMap
                    },
                    contextMenu.fieldValue
                  );
                }
                setContextMenu(null);
              }}
            >
              添加值映射
            </button>
            <button
              className="w-full px-4 py-2 text-left text-xs hover:bg-slate-700 text-white"
              onClick={() => {
                navigator.clipboard.writeText(contextMenu.fieldValue);
                setContextMenu(null);
              }}
            >
              复制值
            </button>
          </div>
        </div>
      )}

      {showValueMapModal && valueMapEditor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-5">
            <h3 className="text-sm font-bold mb-4">编辑值映射</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">字段 JSON Path</p>
                <input
                  type="text"
                  value={valueMapEditor.jsonPath}
                  onChange={(e) => setValueMapEditor(prev => prev ? { ...prev, jsonPath: e.target.value } : prev)}
                  placeholder="如: WhiteBalance 或 EXIF.WhiteBalance"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-[var(--border-color)] text-xs font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="rounded-xl border border-[var(--border-color)] p-3 bg-slate-500/5">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
                  <span className="text-[10px] text-slate-400">原值</span>
                  <span className="text-[10px] text-slate-400">映射值</span>
                  <span />
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                  {valueMapEditor.rows.map((row) => (
                    <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <input
                        type="text"
                        value={row.from}
                        onChange={(e) => setValueMapEditor(prev => prev ? {
                          ...prev,
                          rows: prev.rows.map(r => r.id === row.id ? { ...r, from: e.target.value } : r)
                        } : prev)}
                        placeholder="原值"
                        className="px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-[var(--border-color)] text-xs font-mono focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={row.to}
                        onChange={(e) => setValueMapEditor(prev => prev ? {
                          ...prev,
                          rows: prev.rows.map(r => r.id === row.id ? { ...r, to: e.target.value } : r)
                        } : prev)}
                        placeholder="映射后"
                        className="px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-[var(--border-color)] text-xs focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => setValueMapEditor(prev => prev ? {
                          ...prev,
                          rows: prev.rows.length <= 1 ? prev.rows : prev.rows.filter(r => r.id !== row.id)
                        } : prev)}
                        className="px-2 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setValueMapEditor(prev => prev ? { ...prev, rows: [...prev.rows, createValueMapRow()] } : prev)}
                  className="mt-3 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 text-[10px] font-bold hover:bg-blue-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  添加映射行
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleSaveValueMap}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600"
              >
                保存到数据库
              </button>
              <button
                onClick={() => {
                  setShowValueMapModal(false);
                  setValueMapEditor(null);
                }}
                className="px-4 py-2 bg-slate-500/10 rounded-lg text-xs"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-500/10">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-3xl font-black tracking-tighter">{t('metadata.title') || '元数据配置'}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase">
              {t('metadata.subtitle') || '配置字段解析和展示'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleResetFields} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-500/5 border text-xs font-bold">
            <RefreshCw className="w-4 h-4" />
            {t('metadata.resetFields') || '重置字段'}
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 text-blue-500 border text-xs font-bold">
            <Plus className="w-4 h-4" />
            {t('metadata.addField') || '新增字段'}
          </button>
          <button
            onClick={() => setShowDocModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 text-green-500 border border-green-500/20 text-xs font-bold"
          >
            <BookOpen className="w-4 h-4" />
            {t('metadata.viewDoc') || '参数说明'}
          </button>
          <button
            onClick={() => setShowJsonPanel(!showJsonPanel)}
            className={cn("px-4 py-2 rounded-xl text-xs font-bold", showJsonPanel ? "bg-blue-500 text-white" : "bg-slate-500/5 border")}
          >
            {showJsonPanel ? t('metadata.hideJson') || '隐藏JSON' : t('metadata.showJson') || '显示JSON'}
          </button>
          {activeTab !== 'parse' && (
            <button
              onClick={() => {
                const exportData = {
                  version: '1.0',
                  fields: fields,
                  displayConfig: displayConfig
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `metadata-config-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-xs font-bold"
            >
              <Download className="w-4 h-4" />
              导出配置
            </button>
          )}
          {activeTab !== 'parse' && (
            <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-500/10 text-slate-400 border border-slate-500/20 text-xs font-bold cursor-pointer hover:bg-slate-500/20">
              <Upload className="w-4 h-4" />
              导入配置
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const imported = JSON.parse(text);
                    if (imported.fields && Array.isArray(imported.fields)) {
                      const newFields = [...imported.fields];
                      setFields(newFields);
                      saveFieldsToDatabase(newFields);
                      onFieldsChange?.(newFields);
                    }
                    if (imported.displayConfig) {
                      setDisplayConfig(imported.displayConfig);
                      setHasDisplayChanges(true);
                    }
                    alert('配置导入成功！');
                  } catch (err) {
                    alert('配置导入失败，请检查文件格式');
                  }
                  e.target.value = '';
                }}
              />
            </label>
          )}

      </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-[var(--border-color)] pb-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-t-xl text-xs font-bold transition-all",
              activeTab === tab.key
                ? "bg-blue-500 text-white"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-500/5"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        {activeTab !== 'parse' && (
          <button
            onClick={handleSaveDisplay}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold",
              hasDisplayChanges ? "bg-blue-500 text-white" : "bg-slate-500/5 border"
            )}
          >
            <Save className="w-4 h-4" />
            {hasDisplayChanges ? (t('metadata.saveConfig') || '保存配置') : (t('metadata.saved') || '已保存')}
          </button>
        )}
      </div>

      {activeTab === 'parse' ? renderParseConfig() : renderDisplayConfig(activeTab as DisplayType)}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-96">
            <h3 className="text-lg font-bold mb-4">{t('metadata.addCustomField') || '新增自定义字段'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-2">{t('metadata.fieldKey') || '字段 Key'}</label>
                <input
                  type="text"
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value)}
                  placeholder="如: filmSimulation"
                  className="w-full px-3 py-2 rounded-xl bg-slate-500/5 border text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-2">{t('metadata.fieldLabel') || '显示名称'}</label>
                <input
                  type="text"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder="如: 胶片模拟"
                  className="w-full px-3 py-2 rounded-xl bg-slate-500/5 border text-xs"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); setNewFieldKey(''); setNewFieldLabel(''); }}
                className="flex-1 px-4 py-2 rounded-xl bg-slate-500/10 text-xs font-bold"
              >
                {t('common.cancel') || '取消'}
              </button>
              <button
                onClick={handleAddField}
                className="flex-1 px-4 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold"
              >
                {t('common.add') || '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DocumentationModal isOpen={showDocModal} onClose={() => setShowDocModal(false)} />
    </div>
  );
}
