import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'danger';
}

export function ConfirmModal({ 
  title, 
  message, 
  confirmLabel = 'Confirm', 
  cancelLabel = 'Cancel', 
  onConfirm, 
  onCancel, 
  variant = 'default' 
}: ConfirmModalProps) {
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
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              variant === 'danger' ? "bg-red-500/10" : "bg-blue-500/10"
            )}>
              {variant === 'danger' ? (
                <AlertCircle className="w-6 h-6 text-red-500" />
              ) : (
                <Check className="w-6 h-6 text-blue-500" />
              )}
            </div>
            <h2 className="text-2xl font-black tracking-tight">{title}</h2>
          </div>
          <button 
            onClick={onCancel}
            className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-10">
          <p className="text-sm text-slate-400 mb-8">{message}</p>

          <div className="flex gap-4">
            <button 
              onClick={onCancel}
              className="flex-1 py-4 bg-slate-500/5 border border-[var(--border-color)] text-slate-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-500/10 transition-all"
            >
              {cancelLabel}
            </button>
            <button 
              onClick={onConfirm}
              className={cn(
                "flex-1 py-4 rounded-2xl font-bold transition-all shadow-lg",
                variant === 'danger' 
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                  : "bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20"
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}