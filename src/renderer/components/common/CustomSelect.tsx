import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  className?: string;
}

export function CustomSelect({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  className 
}: CustomSelectProps) {
  return (
    <div className={cn("relative group", className)}>
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-500/5 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold appearance-none cursor-pointer hover:bg-slate-500/10 transition-all pr-12 text-sm dark:text-white"
      >
        {placeholder && <option value="" className="bg-slate-900">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-blue-500 transition-colors">
        <ChevronDown className="w-4 h-4" />
      </div>
    </div>
  );
}