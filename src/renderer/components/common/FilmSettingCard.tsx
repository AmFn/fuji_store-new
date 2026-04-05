import React from 'react';
import { cn } from '../../lib/utils';

interface FilmSettingCardProps {
  label: string;
  value?: string;
}

export function FilmSettingCard({ label, value }: FilmSettingCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col gap-1 shadow-sm">
      <span className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</span>
      <span className="text-sm font-black text-slate-900 dark:text-white">{value || '0'}</span>
    </div>
  );
}
