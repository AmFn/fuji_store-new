import React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CustomDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export function CustomDatePicker({ 
  value, 
  onChange, 
  className 
}: CustomDatePickerProps) {
  return (
    <div className={cn("relative group", className)}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors z-10">
        <Calendar className="w-4 h-4" />
      </div>
      <input 
        type="date" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-500/5 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl pl-12 pr-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold cursor-pointer hover:bg-slate-500/10 transition-all dark:color-scheme-dark text-sm dark:text-white"
      />
    </div>
  );
}