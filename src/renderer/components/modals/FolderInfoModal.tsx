import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FolderInfoModalProps {
  folder: {
    name: string;
    path: string;
  };
  onCancel: () => void;
  onSelectNewPath: () => void;
}

export function FolderInfoModal({ 
  folder, 
  onCancel, 
  onSelectNewPath 
}: FolderInfoModalProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl"
      onClick={onCancel}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="glass w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-500/10">
              <Info className="w-6 h-6 text-blue-500" />
            </div>
            <h2 className="text-2xl font-black tracking-tight">Folder Info</h2>
          </div>
          <button 
            onClick={onCancel}
            className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-10">
          <div className="mb-6">
            <p className="text-sm text-slate-500 mb-2">Folder Name</p>
            <p className="text-lg font-semibold">{folder.name}</p>
          </div>
          
          <div className="mb-8">
            <p className="text-sm text-slate-500 mb-2">Physical Path</p>
            <p className="text-sm text-slate-400 bg-slate-500/5 p-3 rounded-lg break-all">{folder.path}</p>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={onCancel}
              className="flex-1 py-4 bg-slate-500/5 border border-[var(--border-color)] text-slate-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-500/10 transition-all"
            >
              Close
            </button>
            <button 
              onClick={onSelectNewPath}
              className="flex-1 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20"
            >
              Select New Path
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
