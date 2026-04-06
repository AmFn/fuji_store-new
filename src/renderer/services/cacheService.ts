import { LRUCache } from 'lru-cache';
import { Photo } from '../types';

const PHOTO_PAGE_TTL_MS = 5 * 60 * 1000;
const TIMELINE_TTL_MS = 10 * 60 * 1000;

type PhotoPageEntry = {
  items: Photo[];
  totalPages: number;
};

const photoPageCache = new LRUCache<string, PhotoPageEntry>({
  max: 120,
  ttl: PHOTO_PAGE_TTL_MS,
});

const timelineSnapshotCache = new LRUCache<string, Photo[]>({
  max: 10,
  ttl: TIMELINE_TTL_MS,
});

const timelineDayCache = new LRUCache<string, Photo[]>({
  max: 800,
  ttl: TIMELINE_TTL_MS,
});

function buildPhotoPageKey(page: number, pageSize: number, thumbnailDir: string | null) {
  return `${page}:${pageSize}:${thumbnailDir || 'none'}`;
}

export function getPhotoPageCache(page: number, pageSize: number, thumbnailDir: string | null): PhotoPageEntry | null {
  return photoPageCache.get(buildPhotoPageKey(page, pageSize, thumbnailDir)) || null;
}

export function setPhotoPageCache(page: number, pageSize: number, thumbnailDir: string | null, entry: PhotoPageEntry) {
  photoPageCache.set(buildPhotoPageKey(page, pageSize, thumbnailDir), entry);
}

export function clearPhotoPageCache() {
  photoPageCache.clear();
}

export function getTimelineSnapshotCache(key = 'default'): Photo[] | null {
  return timelineSnapshotCache.get(key) || null;
}

export function setTimelineSnapshotCache(items: Photo[], key = 'default') {
  timelineSnapshotCache.set(key, items);
}

export function getTimelineDayCache(dayKey: string): Photo[] | null {
  return timelineDayCache.get(dayKey) || null;
}

export function setTimelineDayCache(dayKey: string, items: Photo[]) {
  timelineDayCache.set(dayKey, items);
}

export function clearTimelineCache() {
  timelineSnapshotCache.clear();
  timelineDayCache.clear();
}

