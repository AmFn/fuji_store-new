import React from 'react';
import { Photo } from '../../types';

interface ThumbImageProps {
  photo: Photo;
  className?: string;
  alt?: string;
}

export function ThumbImage({ photo, className, alt }: ThumbImageProps) {
  return <img src={photo.thumbnailUrl} className={className} alt={alt || photo.fileName} loading="lazy" />;
}