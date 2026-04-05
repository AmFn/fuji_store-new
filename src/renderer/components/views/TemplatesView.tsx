import React from 'react';
import { motion } from 'framer-motion';
import { Palette } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ExportTemplatesProps {
  theme: string;
  onTryTemplate: (templateId: string) => void;
}

const templates = [
  { id: 'minimal', name: 'Minimalist', description: 'Clean, white background with centered photo and recipe below.', preview: 'https://picsum.photos/seed/minimal/400/600' },
  { id: 'magazine', name: 'Magazine', description: 'Elegant serif fonts with overlapping elements and artistic layout.', preview: 'https://picsum.photos/seed/magazine/400/600' },
  { id: 'insta', name: 'Insta-Square', description: '1:1 ratio with polaroid-style border and recipe at the bottom.', preview: 'https://picsum.photos/seed/insta/400/400' },
  { id: 'darktech', name: 'Dark Cinematic', description: 'Dark background with neon accents and technical EXIF display.', preview: 'https://picsum.photos/seed/dark/400/600' },
  { id: 'custom', name: 'Custom Design', description: 'Design your own layout, colors, and EXIF fields.', preview: 'https://picsum.photos/seed/custom/400/600' }
];

export function TemplatesView({ theme, onTryTemplate }: ExportTemplatesProps) {
  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tighter">Export Templates</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Choose a style for your recipe sharing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {templates.map(template => (
          <motion.div 
            key={template.id}
            whileHover={{ y: -8 }}
            className="glass-card rounded-[2rem] overflow-hidden flex flex-col group"
          >
            <div className="aspect-[3/4] relative overflow-hidden bg-slate-500/5">
              <img src={template.preview} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500" alt={template.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                <p className="text-white text-xs font-bold leading-relaxed">{template.description}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black">{template.name}</h3>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Palette className="w-4 h-4 text-blue-500" />
                </div>
              </div>
              <button 
                onClick={() => onTryTemplate(template.id)}
                className="w-full py-3 bg-slate-500/5 hover:bg-slate-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-[var(--border-color)]"
              >
                Try Style
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
