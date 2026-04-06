import React, { useState, useCallback, useEffect } from 'react';
import { Upload, X, ChevronDown, Copy, RefreshCw, Check, ArrowLeft, Plus, Trash2, Eye, Image, FileText, Settings, BookOpen } from 'lucide-react';
import { MetadataParser, MetadataFieldConfig, MetadataDisplayConfig, ParsedMetadata, DisplayType } from '../../utils/metadataParser';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../hooks/useLanguage';
import { DocumentationModal } from '../modals/DocumentationModal';

interface MetadataParserViewProps {
  onBack?: () => void;
  onFieldsChange?: (fields: MetadataFieldConfig[]) => void;
  onDisplayConfigChange?: (config: Record<DisplayType, string[]>) => void;
}

const DEFAULT_FIELDS: MetadataFieldConfig[] = [
  { key: 'filmSimulation', label: '胶片模拟', labelKey: 'metadata.filmSimulation', jsonPath: 'FilmMode', isEnabled: true, isCustom: false },
  { key: 'whiteBalance', label: '白平衡', labelKey: 'metadata.whiteBalance', jsonPath: 'WhiteBalance', isEnabled: true, isCustom: false },
  { key: 'whiteBalanceShift', label: '白平衡偏移', labelKey: 'metadata.whiteBalanceShift', jsonPath: 'WBShift', isEnabled: true, isCustom: false },
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

function saveFieldsToStorage(fields: MetadataFieldConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
  } catch (error) {
    console.error('[MetadataParserView] Error saving fields:', error);
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
  const [fields, setFields] = useState<MetadataFieldConfig[]>(loadFieldsFromStorage);
  const [displayConfig, setDisplayConfig] = useState<Record<DisplayType, string[]>>(loadDisplayConfigFromStorage);
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
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    saveFieldsToStorage(fields);
    onFieldsChange?.(fields);
  }, [fields, onFieldsChange]);

  useEffect(() => {
    saveDisplayConfigToStorage(displayConfig);
    onDisplayConfigChange?.(displayConfig);
  }, [displayConfig, onDisplayConfigChange]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const filePath = (file as any).path || file.name;
      const parsed = await MetadataParser.parseFile(filePath);
      setMetadata(parsed);
      setShowJsonPanel(true);

      const mappingConfig: Record<string, string> = {};
      fields.filter(f => f.isEnabled).forEach(f => {
        mappingConfig[f.key] = f.jsonPath;
      });

      const extracted = MetadataParser.extractFieldsFromConfig(parsed, mappingConfig);
      setExtractedFields(extracted);
    } catch (error) {
      console.error('Error parsing file:', error);
    }
  }, [fields]);

  const handleFieldUpdate = (key: string, updates: Partial<MetadataFieldConfig>) => {
    setFields(prev => prev.map(f => f.key === key ? { ...f, ...updates } : f));
  };

  const handleSaveField = () => {
    if (editingField && tempField.jsonPath) {
      handleFieldUpdate(editingField, tempField);
    }
    setEditingField(null);
    setTempField({});
  };

  const handleAddField = () => {
    if (!newFieldKey || !newFieldLabel) return;
    
    const key = newFieldKey.toLowerCase().replace(/\s+/g, '');
    if (fields.some(f => f.key === key)) {
      alert('字段 key 已存在');
      return;
    }

    setFields(prev => [...prev, {
      key,
      label: newFieldLabel,
      jsonPath: '',
      isEnabled: true,
      isCustom: true
    }]);
    
    setNewFieldKey('');
    setNewFieldLabel('');
    setShowAddModal(false);
  };

  const handleDeleteField = (key: string) => {
    setFields(prev => prev.filter(f => f.key !== key));
    const newConfig = { ...displayConfig };
    Object.keys(newConfig).forEach(k => {
      newConfig[k as DisplayType] = newConfig[k as DisplayType].filter(fk => fk !== key);
    });
    setDisplayConfig(newConfig);
    setHasChanges(true);
  };

  const handleResetFields = () => {
    setFields([...DEFAULT_FIELDS]);
    setExtractedFields({});
  };

  const handleResetDisplayConfig = () => {
    const newConfig = { ...DEFAULT_DISPLAY_CONFIG };
    setDisplayConfig(newConfig);
    setHasChanges(true);
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
    setHasChanges(true);
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
    setHasChanges(true);
  };

  const rawKeys = metadata ? MetadataParser.getAllRawKeys(metadata) : [];
  const enabledFields = fields.filter(f => f.isEnabled);

  const getFieldLabel = (field: MetadataFieldConfig): string => {
    if (field.labelKey && t(field.labelKey) !== field.labelKey) {
      return t(field.labelKey);
    }
    return field.label;
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
            <div className="border-2 border-dashed border-[var(--border-color)] rounded-3xl p-12 flex flex-col items-center justify-center text-center hover:border-blue-500/30 hover:bg-blue-500/5 transition-all cursor-pointer relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
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
                      <div key={field.key} className="bg-white/50 dark:bg-black/20 rounded-lg p-2">
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
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tempField.jsonPath || ''}
                          onChange={(e) => setTempField({ ...tempField, jsonPath: e.target.value })}
                          placeholder="输入JSON路径"
                          className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-[var(--border-color)] text-xs font-mono focus:outline-none focus:border-blue-500"
                          autoFocus
                        />
                        <button onClick={handleSaveField} className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingField(null)} className="p-2 bg-slate-500/10 rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingField(field.key); setTempField({ jsonPath: field.jsonPath, label: field.label }); }}
                          className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-[var(--border-color)] hover:border-blue-500/30"
                        >
                          <span className="text-xs font-mono truncate">{field.jsonPath || '点击配置'}</span>
                          <ChevronDown className="w-4 h-4 text-slate-400" />
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
              <h4 className="text-xs font-bold mb-2">可用字段 ({rawKeys.length})</h4>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {rawKeys.slice(0, 50).map((key) => (
                  <button
                    key={key}
                    onClick={() => editingField && setTempField(prev => ({ ...prev, jsonPath: key }))}
                    className="px-2 py-1 rounded-md bg-slate-500/10 text-[8px] font-mono hover:bg-blue-500/10 truncate max-w-[150px]"
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
            onClick={() => {
              onDisplayConfigChange?.(displayConfig);
              setHasChanges(false);
            }}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold",
              hasChanges ? "bg-blue-500 text-white" : "bg-slate-500/5 border"
            )}
          >
            {hasChanges ? (t('metadata.saveConfig') || '保存配置') : (t('metadata.saved') || '已保存')}
          </button>
          <button
            onClick={() => setShowJsonPanel(!showJsonPanel)}
            className={cn("px-4 py-2 rounded-xl text-xs font-bold", showJsonPanel ? "bg-blue-500 text-white" : "bg-slate-500/5 border")}
          >
            {showJsonPanel ? t('metadata.hideJson') || '隐藏JSON' : t('metadata.showJson') || '显示JSON'}
          </button>
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
