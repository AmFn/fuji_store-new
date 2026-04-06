import React, { useEffect, useMemo, useState } from 'react';
import { Photo } from '../../types';
import { PLACEHOLDER_IMAGE } from '../../constants/assets';

interface ThumbImageProps {
  photo: Photo;
  className?: string;
  alt?: string;
}

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
    if (!window.electronAPI?.getThumbnail || recovering) {
      setSrc(photo.previewUrl || PLACEHOLDER_IMAGE);
      return;
    }

    setRecovering(true);
    try {
      const result = await window.electronAPI.getThumbnail(photo.filePath, photo.hash);
      if (result?.success && result.thumbnailPath) {
        setSrc(toFileUrl(result.thumbnailPath));
        return;
      }
    } catch {
      // Ignore and fallback below.
    }

    setSrc(photo.previewUrl || PLACEHOLDER_IMAGE);
  };

  return <img src={src} className={className} alt={alt || photo.fileName} loading="lazy" onError={handleError} />;
}
