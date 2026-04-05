import React from 'react';
import { cn } from '../../lib/utils';

interface FilmTagProps {
  label: string;
  value?: string;
  primary?: boolean;
  className?: string;
}

export function FilmTag({ label, value, primary, className }: FilmTagProps) {
  return (
    <div className={cn(
      "flex flex-col px-2 py-1.5 rounded-lg text-[8px] font-black border transition-all",
      primary 
        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" 
        : "bg-slate-500/5 text-slate-500 border-[var(--border-color)]",
      className
    )}>
      <div className="flex items-center justify-between opacity-60 mb-0.5">
        <span className="uppercase tracking-tighter">{label}</span>
      </div>
      <span className="uppercase tracking-tight truncate text-[9px]">{value || '0'}</span>
    </div>
  );
}