import React from 'react';
import { cn } from '../../lib/utils';

interface CompactExifProps {
  icon: React.ReactNode;
  value?: string;
  className?: string;
}

export function CompactExif({ icon, value, className }: CompactExifProps) {
  return (
    <div className={cn("bg-slate-500/5 p-2 rounded-xl border border-[var(--border-color)] flex items-center gap-2 min-w-0", className)}>
      <div className="text-slate-400 flex-shrink-0">{icon}</div>
      <p className="text-[10px] font-black truncate">{value || '-'}</p>
    </div>
  );
}