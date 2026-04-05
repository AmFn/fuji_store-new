import React from 'react';
import { cn } from '../../lib/utils';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  theme: string;
}

export function NavItem({ icon, label, active, onClick, theme }: NavItemProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group",
        active 
          ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
          : "text-slate-400 hover:bg-blue-500/5 hover:text-blue-500"
      )}
    >
      <span className={cn("transition-colors", active ? "text-white" : "text-slate-500 group-hover:text-blue-500")}>
        {icon}
      </span>
      {label}
    </button>
  );
}