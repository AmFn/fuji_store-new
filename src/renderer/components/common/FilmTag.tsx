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
      "flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black border transition-all",
      primary 
        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" 
        : "bg-slate-500/5 text-slate-500 border-[var(--border-color)]",
      className
    )}>
      <span className="uppercase tracking-widest opacity-60">{label}</span>
      <span className="uppercase tracking-widest">{value || '0'}</span>
    </div>
  );
}