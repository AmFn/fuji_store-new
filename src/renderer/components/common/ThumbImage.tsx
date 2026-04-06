import React, { useEffect, useMemo, useState } from 'react';
import { Photo } from '../../types';
import { PLACEHOLDER_IMAGE } from '../../constants/assets';
import { LRUCache } from 'lru-cache';

interface ThumbImageProps {
  photo: Photo;
  className?: string;
  alt?: string;
}

const thumbSrcCache = new LRUCache<string, string>({
  max: 2000,
  ttl: 30 * 60 * 1000,
});

const thumbFailureCache = new LRUCache<string, true>({
  max: 2000,
  ttl: 5 * 60 * 1000,
});

export function ThumbImage({ photo, className, alt }: ThumbImageProps) {
  const initialSrc = useMemo(() => photo.thumbnailUrl || photo.previewUrl || PLACEHOLDER_IMAGE, [photo.thumbnailUrl, photo.previewUrl]);
  const [src, setSrc] = useState(initialSrc);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    setSrc(initialSrc);
    setRecovering(false);
  }, [initialSrc, photo.filePath, photo.hash]);

  const toFileUrl = (inputPath: string) => {
    const normalized = (inputPath || '').replace(/\\/g, '/');
    if (!normalized) return '';
    if (normalized.startsWith('file://')) return normalized;
    if (/^[A-Za-z]:\//.test(normalized)) return `file:///${encodeURI(normalized)}`;
    if (normalized.startsWith('/')) return `file://${encodeURI(normalized)}`;
    return `file:///${encodeURI(normalized)}`;
  };

  const handleError = async () => {
    const cacheKey = `${photo.hash || ''}|${photo.filePath || ''}`;
    const cachedSrc = thumbSrcCache.get(cacheKey);
    if (cachedSrc) {
      setSrc(cachedSrc);
      return;
    }
    if (thumbFailureCache.has(cacheKey)) {
      setSrc(photo.previewUrl || PLACEHOLDER_IMAGE);
      return;
    }

    if (!window.electronAPI?.getThumbnail || recovering) {
      setSrc(photo.previewUrl || PLACEHOLDER_IMAGE);
      return;
    }

    setRecovering(true);
    try {
      const result = await window.electronAPI.getThumbnail(photo.filePath, photo.hash);
      if (result?.success && result.thumbnailPath) {
        const next = toFileUrl(result.thumbnailPath);
        thumbSrcCache.set(cacheKey, next);
        setSrc(next);
        return;
      }
    } catch {
      // Ignore and fallback below.
    }

    thumbFailureCache.set(cacheKey, true);
    setSrc(photo.previewUrl || PLACEHOLDER_IMAGE);
  };

  return <img src={src} className={className} alt={alt || photo.fileName} loading="lazy" onError={handleError} />;
}
