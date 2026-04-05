import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative z-[60]", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between bg-slate-500/5 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold transition-all hover:bg-slate-500/10 text-sm",
          isOpen && "ring-2 ring-blue-500/50 border-blue-500/30"
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-slate-500")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-slate-400"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 mt-3 p-2 bg-[var(--bg-primary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden z-[70]"
          >
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {options.length === 0 ? (
                <div className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                  No options available
                </div>
              ) : (
                options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all text-left",
                      opt.value === value 
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
                        : "hover:bg-slate-500/10 text-slate-400 hover:text-white"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {opt.value === value && <Check className="w-4 h-4" />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
