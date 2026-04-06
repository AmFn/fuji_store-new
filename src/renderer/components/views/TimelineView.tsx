import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, ChevronDown, ExternalLink } from 'lucide-react';
import { Photo } from '../../types';

interface TimelineViewProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
  onSearchDate: (date: string) => void;
}

type DaySummary = {
  dayKey: string;
  label: string;
  count: number;
  preview: Photo[];
};

type YearSummary = {
  year: string;
  count: number;
  days: DaySummary[];
};

type TimelineRow =
  | { type: 'year'; id: string; year: string; count: number }
  | { type: 'day'; id: string; day: DaySummary };

const pad2 = (v: number) => String(v).padStart(2, '0');
const dateLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const YEAR_ROW_HEIGHT = 110;
const DAY_ROW_HEIGHT_EXPANDED = 270;
const DAY_ROW_HEIGHT_COLLAPSED = 78;
const OVERSCAN_PX = 700;
const TIMELINE_UI_STORAGE_KEY = 'fuji_timeline_ui_v1';

type TimelineUIPrefs = {
  collapsedYears?: string[];
  collapsedDays?: string[];
  visibleYearCount?: number;
};

function lowerBound(arr: number[], target: number): number {
  let l = 0;
  let r = arr.length - 1;
  while (l < r) {
    const m = (l + r) >> 1;
    if (arr[m] < target) l = m + 1;
    else r = m;
  }
  return l;
}

export const TimelineView = React.memo(function TimelineView({ photos, onSearchDate }: TimelineViewProps) {
  const initialPrefs = useMemo<TimelineUIPrefs | null>(() => {
    try {
      const raw = localStorage.getItem(TIMELINE_UI_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }, []);

  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(
    () => new Set(initialPrefs?.collapsedYears || [])
  );
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(
    () => new Set(initialPrefs?.collapsedDays || [])
  );
  const [visibleYearCount, setVisibleYearCount] = useState(
    () => Math.max(1, Number(initialPrefs?.visibleYearCount || 2))
  );
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(760);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollTopRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const initializedDefaultDaysRef = useRef(Boolean(initialPrefs));

  const timeline = useMemo<YearSummary[]>(() => {
    const years = new Map<string, { count: number; days: Map<string, DaySummary> }>();
    for (const photo of photos) {
      if (!photo?.dateTime) continue;
      const dt = new Date(photo.dateTime);
      if (Number.isNaN(dt.getTime())) continue;
      const year = String(dt.getFullYear());
      const dayKey = `${year}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;

      let yearBucket = years.get(year);
      if (!yearBucket) {
        yearBucket = { count: 0, days: new Map<string, DaySummary>() };
        years.set(year, yearBucket);
      }
      yearBucket.count += 1;

      let day = yearBucket.days.get(dayKey);
      if (!day) {
        day = {
          dayKey,
          label: dateLabelFormatter.format(dt),
          count: 0,
          preview: [],
        };
        yearBucket.days.set(dayKey, day);
      }
      day.count += 1;
      if (day.preview.length < 4) {
        day.preview.push(photo);
      }
    }

    return Array.from(years.entries())
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, bucket]) => ({
        year,
        count: bucket.count,
        days: Array.from(bucket.days.values()).sort((a, b) => b.dayKey.localeCompare(a.dayKey)),
      }));
  }, [photos]);

  const sortedYears = useMemo(() => timeline.map((y) => y.year), [timeline]);
  const visibleTimeline = useMemo(() => timeline.slice(0, visibleYearCount), [timeline, visibleYearCount]);
  const allDayKeys = useMemo(() => timeline.flatMap((y) => y.days.map((d) => d.dayKey)), [timeline]);
  const latestDayKey = allDayKeys.length > 0 ? allDayKeys[0] : null;

  useEffect(() => {
    setVisibleYearCount(2);
    setScrollTop(0);
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [photos.length, initialPrefs]);

  useEffect(() => {
    const validYears = new Set(sortedYears);
    const validDays = new Set(allDayKeys);
    setCollapsedYears((prev) => new Set([...prev].filter((y) => validYears.has(y))));
    setCollapsedDays((prev) => new Set([...prev].filter((d) => validDays.has(d))));
  }, [sortedYears, allDayKeys]);

  useEffect(() => {
    if (initializedDefaultDaysRef.current) return;
    if (allDayKeys.length === 0) return;
    const defaults = new Set(allDayKeys);
    if (latestDayKey) {
      defaults.delete(latestDayKey);
    }
    setCollapsedDays(defaults);
    initializedDefaultDaysRef.current = true;
  }, [allDayKeys, latestDayKey]);

  useEffect(() => {
    try {
      const payload: TimelineUIPrefs = {
        collapsedYears: [...collapsedYears],
        collapsedDays: [...collapsedDays],
        visibleYearCount,
      };
      localStorage.setItem(TIMELINE_UI_STORAGE_KEY, JSON.stringify(payload));
    } catch {
    }
  }, [collapsedYears, collapsedDays, visibleYearCount]);

  useEffect(() => {
    const handleResize = () => {
      if (scrollerRef.current) {
        setViewportHeight(scrollerRef.current.clientHeight || 760);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  const toggleYearCollapse = (year: string) => {
    const next = new Set(collapsedYears);
    if (next.has(year)) next.delete(year);
    else next.add(year);
    setCollapsedYears(next);
  };

  const toggleDayCollapse = (dayKey: string) => {
    const next = new Set(collapsedDays);
    if (next.has(dayKey)) next.delete(dayKey);
    else next.add(dayKey);
    setCollapsedDays(next);
  };

  const rows = useMemo<TimelineRow[]>(() => {
    const out: TimelineRow[] = [];
    for (const y of visibleTimeline) {
      out.push({ type: 'year', id: `year-${y.year}`, year: y.year, count: y.count });
      if (!collapsedYears.has(y.year)) {
        for (const day of y.days) {
          out.push({ type: 'day', id: `day-${day.dayKey}`, day });
        }
      }
    }
    return out;
  }, [visibleTimeline, collapsedYears]);

  const cumulativeHeights = useMemo(() => {
    const arr = new Array(rows.length + 1);
    arr[0] = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const h = rows[i].type === 'year'
        ? YEAR_ROW_HEIGHT
        : (collapsedDays.has(rows[i].day.dayKey) ? DAY_ROW_HEIGHT_COLLAPSED : DAY_ROW_HEIGHT_EXPANDED);
      arr[i + 1] = arr[i] + h;
    }
    return arr;
  }, [rows, collapsedDays]);

  const totalHeight = cumulativeHeights[cumulativeHeights.length - 1] || 0;

  const { startIndex, endIndex, topSpacer, bottomSpacer } = useMemo(() => {
    if (rows.length === 0) {
      return { startIndex: 0, endIndex: -1, topSpacer: 0, bottomSpacer: 0 };
    }

    const startPx = Math.max(0, scrollTop - OVERSCAN_PX);
    const endPx = Math.min(totalHeight, scrollTop + viewportHeight + OVERSCAN_PX);

    let start = lowerBound(cumulativeHeights, startPx);
    if (start > 0) start -= 1;
    let end = lowerBound(cumulativeHeights, endPx);
    if (end < rows.length) end += 1;

    start = Math.max(0, Math.min(start, rows.length - 1));
    end = Math.max(start, Math.min(end, rows.length - 1));

    const top = cumulativeHeights[start] || 0;
    const bottom = Math.max(0, totalHeight - (cumulativeHeights[end + 1] || totalHeight));

    return { startIndex: start, endIndex: end, topSpacer: top, bottomSpacer: bottom };
  }, [rows.length, cumulativeHeights, scrollTop, viewportHeight, totalHeight]);

  const visibleRows = useMemo(() => {
    if (endIndex < startIndex) return [] as TimelineRow[];
    return rows.slice(startIndex, endIndex + 1);
  }, [rows, startIndex, endIndex]);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = e.currentTarget.scrollTop;
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      setScrollTop(scrollTopRef.current);
    });
  }, []);

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
    <div className="h-[calc(100vh-10rem)] relative">
      <div className="absolute left-12 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-slate-500/10 to-transparent z-0" />

      <div className="flex justify-end pr-8 pt-3 pb-4 relative z-10">
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

      <div ref={scrollerRef} onScroll={onScroll} className="h-[calc(100%-3.25rem)] overflow-y-auto pr-2 relative z-10">
        <div style={{ height: topSpacer }} />

        {visibleRows.map((row) => {
          if (row.type === 'year') {
            const isYearCollapsed = collapsedYears.has(row.year);
            return (
              <div key={row.id} className="relative pl-8 pr-8 py-6 bg-[var(--bg-primary)]" style={{ height: YEAR_ROW_HEIGHT }}>
                <div className="flex items-center gap-6 group cursor-pointer" onClick={() => toggleYearCollapse(row.year)}>
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-4 border-blue-500 shadow-lg shadow-blue-500/20 z-10" />
                  <div className="flex items-baseline gap-4">
                    <h2 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">{row.year}</h2>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{row.count} Photos</span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-slate-500/10 to-transparent" />
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isYearCollapsed ? '-rotate-90' : ''}`} />
                </div>
              </div>
            );
          }

          const day = row.day;
          const isCollapsed = collapsedDays.has(day.dayKey);
          return (
            <div
              key={row.id}
              className="relative pl-14 pr-8 py-4 bg-[var(--bg-primary)]"
              style={{ height: isCollapsed ? DAY_ROW_HEIGHT_COLLAPSED : DAY_ROW_HEIGHT_EXPANDED }}
            >
              <div className="w-full text-left group/day">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500/30 group-hover/day:bg-blue-500 transition-colors" />
                  <button
                    onClick={() => toggleDayCollapse(day.dayKey)}
                    className="text-lg font-black tracking-tight text-slate-600 dark:text-slate-300 group-hover/day:text-blue-500 transition-colors"
                  >
                    {day.label}
                  </button>
                  <div className="px-3 py-1 bg-slate-500/5 rounded-full border border-[var(--border-color)]">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{day.count} Photos</span>
                  </div>
                  <button
                    onClick={() => onSearchDate(day.dayKey)}
                    className="p-1 rounded-md text-blue-500 hover:bg-blue-500/10"
                    title="Open filtered photos"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                {!isCollapsed && (
                  <button onClick={() => onSearchDate(day.dayKey)} className="relative h-44 w-full max-w-sm block">
                    {day.preview.map((photo, idx) => (
                      <div
                        key={photo.id}
                        className="absolute inset-0 rounded-3xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-lg"
                        style={{
                          zIndex: 5 - idx,
                          transform: `translate(${idx * 14}px, ${idx * 10}px) rotate(${idx === 0 ? 0 : idx === 1 ? 5 : idx === 2 ? -5 : 3}deg) scale(${1 - idx * 0.04})`,
                        }}
                      >
                        <img src={photo.thumbnailUrl} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                      </div>
                    ))}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ height: bottomSpacer }} />

        {visibleYearCount < sortedYears.length && (
          <div className="px-8 pb-8 flex justify-center">
            <button
              onClick={() => setVisibleYearCount((prev) => Math.min(prev + 2, sortedYears.length))}
              className="px-5 py-2 rounded-full border border-blue-500/30 bg-blue-500/5 text-blue-500 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/10 transition-all"
            >
              Load Older Years
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
