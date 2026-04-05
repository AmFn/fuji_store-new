import React from 'react';
import { cn } from '../../lib/utils';

interface ContextMenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  onClose?: () => void;
}

export function ContextMenuItem({ icon, label, onClick, danger, onClose }: ContextMenuItemProps) {
  return (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        onClick();
        if (onClose) {
          onClose();
        }
      }}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all",
        danger ? "text-red-500 hover:bg-red-500/10" : "text-slate-400 hover:bg-slate-500/10 hover:text-slate-600 dark:hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}