// Film modes and their short codes
export const FILM_MODES = [
  'Provia/Standard', 'Velvia/Vivid', 'Astia/Soft', 'Classic Chrome', 
  'PRO Neg. Hi', 'PRO Neg. Std', 'Classic Neg.', 'Nostalgic Neg.',
  'Eterna/Cinema', 'Eterna Bleach Bypass', 'Acros', 'Monochrome', 'Sepia',
  'Reala Ace'
];

export const FILM_SHORT_CODES: Record<string, string> = {
  'Provia/Standard': 'STD',
  'Velvia/Vivid': 'V',
  'Astia/Soft': 'S',
  'Classic Chrome': 'CC',
  'PRO Neg. Hi': 'NH',
  'PRO Neg. Std': 'NS',
  'Classic Neg.': 'NC',
  'Nostalgic Neg.': 'NN',
  'Eterna/Cinema': 'E',
  'Eterna Bleach Bypass': 'EBB',
  'Acros': 'A',
  'Monochrome': 'M',
  'Sepia': 'SEP',
  'Reala Ace': 'RA'
};

// 富士相机胶片模式十六进制值映射
export const FILM_MODE_HEX_MAP: Record<string, string> = {
  '0x0': 'Provia/Standard',
  '0x100': 'Provia/Standard',
  '0x110': 'Astia/Soft',
  '0x120': 'Astia/Soft',
  '0x130': 'Astia/Soft',
  '0x200': 'Velvia/Vivid',
  '0x300': 'Classic Chrome',
  '0x400': 'Velvia/Vivid',
  '0x500': 'PRO Neg. Std',
  '0x501': 'PRO Neg. Hi',
  '0x600': 'Classic Chrome',
  '0x700': 'Eterna/Cinema',
  '0x800': 'Classic Neg.',
  '0x900': 'Eterna Bleach Bypass',
  '0xa00': 'Nostalgic Neg.',
  '0xb00': 'Reala Ace'
};

export const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];