import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, ChevronDown, ExternalLink, Eye } from 'lucide-react';
import { Photo } from '../../types';

interface TimelineViewProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onSearchDate: (date: string) => void;
}

export function TimelineView({ photos, onPhotoClick, onSearchDate }: TimelineViewProps) {
  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [dateLimits, setDateLimits] = useState<Record<string, number>>({});

  const INITIAL_GRID_LIMIT = 24;
  const LOAD_MORE_STEP = 24;

  // Group photos by Year, then by Date
  const groupedByYear = useMemo(() => {
    return photos.reduce((acc, p) => {
      const d = new Date(p.dateTime || '');
      const year = d.getFullYear().toString();
      const dateKey = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      
      if (!acc[year]) acc[year] = {};
      if (!acc[year][dateKey]) acc[year][dateKey] = [];
      acc[year][dateKey].push(p);
      return acc;
    }, {} as Record<string, Record<string, Photo[]>>);
  }, [photos]);

  const sortedYears = useMemo(() => Object.keys(groupedByYear).sort((a, b) => b.localeCompare(a)), [groupedByYear]);

  // Initialize collapsedDates: only the very first date of the timeline is expanded by default
  useEffect(() => {
    const newCollapsed = new Set<string>();
    let isFirst = true;
    sortedYears.forEach(year => {
      const dates = Object.keys(groupedByYear[year]).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      dates.forEach(date => {
        if (isFirst) {
          isFirst = false;
        } else {
          newCollapsed.add(date);
        }
      });
    });
    setCollapsedDates(newCollapsed);
  }, [sortedYears, groupedByYear]);

  const toggleYearCollapse = (year: string) => {
    const newCollapsed = new Set(collapsedYears);
    if (newCollapsed.has(year)) {
      newCollapsed.delete(year);
    } else {
      newCollapsed.add(year);
    }
    setCollapsedYears(newCollapsed);
  };

  const toggleDateCollapse = (date: string) => {
    const newCollapsed = new Set(collapsedDates);
    if (newCollapsed.has(date)) {
      newCollapsed.delete(date);
    } else {
      newCollapsed.add(date);
    }
    setCollapsedDates(newCollapsed);
  };

  const toggleDateExpand = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
      if (!dateLimits[date]) {
        setDateLimits(prev => ({ ...prev, [date]: INITIAL_GRID_LIMIT }));
      }
    }
    setExpandedDates(newExpanded);
  };

  const loadMorePhotos = (date: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDateLimits(prev => ({ ...prev, [date]: (prev[date] || INITIAL_GRID_LIMIT) + LOAD_MORE_STEP }));
  };

  const flattenedTimeline = useMemo(() => {
    const list: (
      | { type: 'year', year: string, count: number }
      | { type: 'date', date: string, items: Photo[] }
    )[] = [];
    
    sortedYears.forEach(year => {
      const isYearCollapsed = collapsedYears.has(year);
      const dateGroups = groupedByYear[year];
      const sortedDates = Object.keys(dateGroups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      list.push({ 
        type: 'year', 
        year, 
        count: Object.values(dateGroups).flat().length 
      });

      if (!isYearCollapsed) {
        sortedDates.forEach(date => {
          list.push({ 
            type: 'date', 
            date, 
            items: dateGroups[date] 
          });
        });
      }
    });
    return list;
  }, [sortedYears, groupedByYear, collapsedYears]);

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6 text-slate-400">
        <div className="w-20 h-20 bg-slate-500/5 rounded-full flex items-center justify-center">
          <Calendar className="w-10 h-10 opacity-20" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-black text-lg">No Timeline Data</p>
          <p className="text-xs font-bold uppercase tracking-widest opacity-60">Import photos to see your journey</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* Main Timeline Line */}
      <div className="absolute left-12 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-slate-500/10 to-transparent z-0" />

      <div className="flex justify-end pr-8 pt-8 relative z-10">
        <button 
          onClick={() => {
            if (collapsedYears.size === sortedYears.length) {
              setCollapsedYears(new Set());
            } else {
              setCollapsedYears(new Set(sortedYears));
            }
          }}
          className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-600 transition-colors flex items-center gap-2 bg-blue-500/5 px-4 py-2 rounded-full border border-blue-500/10"
        >
          {collapsedYears.size === sortedYears.length ? 'Expand All Years' : 'Collapse All Years'}
        </button>
      </div>

      <div className="relative z-10">
        {flattenedTimeline.map((item, index) => {
          if (item.type === 'year') {
            const isYearCollapsed = collapsedYears.has(item.year);
            return (
              <div key={`year-${item.year}`} className="relative pl-8 pr-8 py-8 bg-[var(--bg-primary)]">
                <div 
                  className="flex items-center gap-6 group cursor-pointer" 
                  onClick={() => toggleYearCollapse(item.year)}
                >
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-4 border-blue-500 shadow-lg shadow-blue-500/20 z-10" />
                  <div className="flex items-baseline gap-4">
                    <h2 className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">{item.year}</h2>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {item.count} Photos
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-slate-500/10 to-transparent" />
                  <motion.div
                    animate={{ rotate: isYearCollapsed ? -90 : 0 }}
                    className="p-2 hover:bg-slate-500/5 rounded-xl transition-all"
                  >
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  </motion.div>
                </div>
              </div>
            );
          }

          const date = item.date;
          const items = item.items;
          const isExpanded = expandedDates.has(date);
          const isDateCollapsed = collapsedDates.has(date);

          return (
            <div key={`date-${date}`} className="relative pl-14 pr-8 py-6 bg-[var(--bg-primary)]">
              <div className="space-y-8">
                <div 
                  className="flex items-center gap-4 cursor-pointer group/date"
                  onClick={() => toggleDateCollapse(date)}
                >
                  <div className="w-3 h-3 rounded-full bg-blue-500/30 group-hover/date:bg-blue-500 transition-colors" />
                  <div className="flex flex-col">
                    <h3 className="text-lg font-black tracking-tight text-slate-600 dark:text-slate-300 group-hover/date:text-blue-500 transition-colors">{date}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-slate-500/5 rounded-full border border-[var(--border-color)]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {items.length} Photos
                      </span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const d = new Date(date);
                        const filterDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        onSearchDate(filterDateStr);
                      }}
                      className="p-2 hover:bg-blue-500/10 rounded-xl text-blue-500 transition-all group/jump"
                      title="View in Gallery"
                    >
                      <ExternalLink className="w-4 h-4 group-hover/jump:scale-110 transition-transform" />
                    </button>
                  </div>
                  <motion.div
                    animate={{ rotate: isDateCollapsed ? -90 : 0 }}
                    className="opacity-0 group-hover/date:opacity-100 transition-opacity"
                  >
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </motion.div>
                </div>

                <AnimatePresence mode="wait">
                  {!isDateCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <AnimatePresence mode="wait">
                        {!isExpanded ? (
                          <motion.div
                            key="stack"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative h-72 w-full max-w-md cursor-pointer group ml-6"
                            onClick={() => toggleDateExpand(date)}
                          >
                            {items.slice(0, 4).map((photo, idx) => (
                              <motion.div
                                key={photo.id}
                                className="absolute inset-0 rounded-[2.5rem] overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl"
                                animate={{ 
                                  zIndex: 4 - idx,
                                  x: idx * 24,
                                  y: idx * 14,
                                  rotate: idx === 0 ? 0 : idx === 1 ? 8 : idx === 2 ? -8 : 4,
                                  scale: 1 - idx * 0.05,
                                }}
                                whileHover={{
                                  x: idx * 36,
                                  y: idx * 20,
                                  rotate: idx === 0 ? -2 : idx === 1 ? 15 : idx === 2 ? -15 : 8,
                                  transition: { type: "spring", stiffness: 300, damping: 20 }
                                }}
                              >
                                <img src={photo.thumbnailUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" loading="lazy" />
                                {idx === 0 && (
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-10">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                      <span className="text-white text-[10px] font-black uppercase tracking-widest opacity-80">Click to reveal album</span>
                                    </div>
                                    <h4 className="text-white text-2xl font-black tracking-tight">{items.length} Photos</h4>
                                    <p className="text-white/40 text-[8px] font-bold uppercase tracking-widest mt-2">{items[0].filmMode} • {items[0].cameraModel}</p>
                                  </div>
                                )}
                              </motion.div>
                            ))}
                            <div className="absolute -inset-10 bg-blue-500/5 blur-[100px] rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="grid"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 30 }}
                            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 ml-6"
                          >
                            {items.slice(0, dateLimits[date] || INITIAL_GRID_LIMIT).map((photo, pIdx) => (
                              <motion.div
                                key={photo.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: pIdx * 0.01 }}
                                whileHover={{ scale: 1.05, y: -8 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onPhotoClick(photo)}
                                className="aspect-square rounded-3xl overflow-hidden cursor-pointer border border-[var(--border-color)] shadow-sm relative group bg-slate-500/5"
                              >
                                <img src={photo.thumbnailUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" loading="lazy" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                  <p className="text-[8px] font-black text-white truncate uppercase tracking-widest">{photo.filmMode}</p>
                                </div>
                                <div className="absolute top-3 right-3 p-2 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Eye className="w-3 h-3 text-white" />
                                </div>
                              </motion.div>
                            ))}
                            
                            {items.length > (dateLimits[date] || INITIAL_GRID_LIMIT) && (
                              <motion.button
                                whileHover={{ scale: 1.05, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => loadMorePhotos(date, e)}
                                className="aspect-square rounded-3xl border-2 border-dashed border-blue-500/30 bg-blue-500/5 flex flex-col items-center justify-center gap-3 transition-all group"
                              >
                                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all">
                                  <ExternalLink className="w-6 h-6 text-blue-500 group-hover:text-white" />
                                </div>
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Load More</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                  {items.length - (dateLimits[date] || INITIAL_GRID_LIMIT)} remaining
                                </span>
                              </motion.button>
                            )}

                            <motion.button 
                              whileHover={{ scale: 1.05, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => toggleDateExpand(date)}
                              className="aspect-square rounded-3xl border-2 border-dashed border-slate-500/30 bg-slate-500/5 flex flex-col items-center justify-center gap-3 transition-all group"
                            >
                              <div className="w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center group-hover:bg-slate-500 group-hover:text-white transition-all">
                                <ChevronDown className="w-6 h-6 text-slate-400 group-hover:text-white" />
                              </div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Collapse</span>
                            </motion.button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}