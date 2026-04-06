export interface ParsedMetadata {
  raw: any;
  filmSimulation?: string;
  whiteBalance?: string;
  whiteBalanceShift?: string;
  dynamicRange?: string;
  sharpness?: string;
  saturation?: string;
  contrast?: string;
  highlightTone?: string;
  shadowTone?: string;
  noiseReduction?: string;
  clarity?: string;
  grainEffect?: string;
  colorChromeEffect?: string;
  colorChromeEffectBlue?: string;
  filmMode?: string;
}

export interface MetadataFieldConfig {
  key: string;
  label: string;
  labelKey?: string;
  jsonPath: string;
  isEnabled: boolean;
  isCustom?: boolean;
}

export type DisplayType = 'photoList' | 'photoDetail' | 'recipeList' | 'recipeDetail';

export interface MetadataDisplayConfig {
  fieldKey: string;
  displayType: DisplayType;
  isEnabled: boolean;
  order: number;
}

export interface MetadataMappingConfig {
  [key: string]: string;
}

const DEFAULT_MAPPING: MetadataFieldConfig[] = [
  { key: 'filmSimulation', label: '胶片模拟', jsonPath: 'FilmMode', isEnabled: true },
  { key: 'whiteBalance', label: '白平衡', jsonPath: 'WhiteBalance', isEnabled: true },
  { key: 'whiteBalanceShift', label: '白平衡偏移', jsonPath: 'WBShift', isEnabled: true },
  { key: 'dynamicRange', label: '动态范围', jsonPath: 'DynamicRange', isEnabled: true },
  { key: 'sharpness', label: '锐度', jsonPath: 'Sharpness', isEnabled: true },
  { key: 'saturation', label: '饱和度', jsonPath: 'Saturation', isEnabled: true },
  { key: 'contrast', label: '对比度', jsonPath: 'Contrast', isEnabled: true },
  { key: 'highlightTone', label: '高光', jsonPath: 'Highlight', isEnabled: true },
  { key: 'shadowTone', label: '阴影', jsonPath: 'Shadow', isEnabled: true },
  { key: 'noiseReduction', label: '降噪', jsonPath: 'NoiseReduction', isEnabled: true },
  { key: 'clarity', label: '清晰度', jsonPath: 'Clarity', isEnabled: true },
  { key: 'grainEffect', label: '颗粒效果', jsonPath: 'GrainEffect', isEnabled: true },
  { key: 'colorChromeEffect', label: '色彩效果', jsonPath: 'ColorChromeEffect', isEnabled: true },
  { key: 'colorChromeEffectBlue', label: '蓝色色彩效果', jsonPath: 'ColorChromeEffectBlue', isEnabled: true },
];

const STORAGE_KEY = 'fuji_metadata_mapping';

export class MetadataParser {
  static async parseFile(filePath: string): Promise<ParsedMetadata> {
    try {
      if (window.electronAPI?.parseMetadata) {
        const metadata = await window.electronAPI.parseMetadata(filePath);
        return { raw: metadata };
      }
      return { raw: {} };
    } catch (error) {
      console.error('[MetadataParser] Error parsing file:', error);
      return { raw: {} };
    }
  }

  static async parseBuffer(_buffer: ArrayBuffer, _filename?: string): Promise<ParsedMetadata> {
    return { raw: {} };
  }

  static async saveMetadataToPhoto(photoId: number, metadata: any): Promise<boolean> {
    try {
      if (window.electronAPI?.saveMetadataToPhoto) {
        return await window.electronAPI.saveMetadataToPhoto(photoId, metadata);
      }
      return false;
    } catch (error) {
      console.error('[MetadataParser] Error saving metadata:', error);
      return false;
    }
  }

  static getDefaultFields(): MetadataFieldConfig[] {
    return [...DEFAULT_MAPPING];
  }

  static getFieldConfigs(): MetadataFieldConfig[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const defaultKeys = new Set(DEFAULT_MAPPING.map(f => f.key));
          return [
            ...DEFAULT_MAPPING.map(df => {
              const existing = parsed.find((p: MetadataFieldConfig) => p.key === df.key);
              return existing ? { ...df, ...existing } : df;
            }),
            ...parsed.filter((p: MetadataFieldConfig) => !defaultKeys.has(p.key))
          ];
        }
      }
    } catch (error) {
      console.error('[MetadataParser] Error loading field configs:', error);
    }
    return [...DEFAULT_MAPPING];
  }

  static saveFieldConfigs(fields: MetadataFieldConfig[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
    } catch (error) {
      console.error('[MetadataParser] Error saving field configs:', error);
    }
  }

  static resetFieldConfigs(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  static extractFields(metadata: ParsedMetadata, fields: MetadataFieldConfig[]): Record<string, string> {
    const result: Record<string, string> = {};
    const raw = metadata.raw || {};

    for (const field of fields) {
      if (!field.isEnabled || !field.jsonPath) continue;
      const value = this.getNestedValue(raw, field.jsonPath);
      if (value !== undefined && value !== null) {
        result[field.key] = String(value);
      }
    }

    return result;
  }

  static extractFieldsFromConfig(metadata: ParsedMetadata, config: MetadataMappingConfig): Record<string, string> {
    const result: Record<string, string> = {};
    const raw = metadata.raw || {};

    for (const [key, jsonPath] of Object.entries(config)) {
      if (!jsonPath) continue;
      const value = this.getNestedValue(raw, jsonPath);
      if (value !== undefined && value !== null) {
        result[key] = String(value);
      }
    }

    return result;
  }

  private static getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[key];
    }
    return current;
  }

  static getAllRawKeys(metadata: ParsedMetadata): string[] {
    const keys: Set<string> = new Set();
    const raw = metadata.raw || {};
    
    const extractKeys = (obj: any, prefix: string = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        keys.add(fullKey);
        if (value && typeof value === 'object' && !(value instanceof Date)) {
          extractKeys(value, fullKey);
        }
      }
    };
    
    extractKeys(raw);
    return Array.from(keys).sort();
  }
}
