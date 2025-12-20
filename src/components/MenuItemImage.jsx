'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

const fallbackImage = '/images/food-mezze.jpg';
const invalidTokens = new Set(['', 'null', 'undefined', 'n/a', 'na']);

const isValidImageSrc = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (invalidTokens.has(trimmed.toLowerCase())) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return true;
  }

  try {
    return Boolean(new URL(trimmed));
  } catch {
    return false;
  }
};

export default function MenuItemImage({
  src,
  alt,
  className = '',
  sizes = '(max-width: 768px) 100vw, 360px',
  priority = false,
}) {
  const normalizedSrc = typeof src === 'string' ? src.trim() : '';
  const hasValidSrc = useMemo(() => isValidImageSrc(normalizedSrc), [normalizedSrc]);
  const [currentSrc, setCurrentSrc] = useState(hasValidSrc ? normalizedSrc : '');

  useEffect(() => {
    if (hasValidSrc) {
      setCurrentSrc(normalizedSrc);
    } else {
      setCurrentSrc('');
    }
  }, [hasValidSrc, normalizedSrc]);

  if (!hasValidSrc) {
    return (
      <div
        role="img"
        aria-label="Image coming soon"
        className={`relative aspect-[4/3] overflow-hidden rounded-xl border border-neutral-200/70 bg-neutral-100/80 ${className}`}
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-500">
          <svg
            aria-hidden="true"
            viewBox="0 0 64 64"
            className="h-10 w-10 text-neutral-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 30h44" />
            <path d="M14 30c0 13 9 22 18 22s18-9 18-22" />
            <path d="M24 16v8" />
            <path d="M32 16v8" />
            <path d="M40 16v8" />
            <path d="M46 18c4 2 6 7 6 12" />
            <path d="M50 46c0 4-2 6-6 6" />
            <path d="M14 46c0 4 2 6 6 6" />
          </svg>
          <span className="text-xs font-medium tracking-wide text-neutral-500">
            Image coming soon
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative aspect-[4/3] overflow-hidden rounded-xl ${className}`}>
      <Image
        src={currentSrc || fallbackImage}
        alt={alt || 'Menu item'}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
        onError={() => {
          if (currentSrc !== fallbackImage) {
            setCurrentSrc(fallbackImage);
          }
        }}
      />
    </div>
  );
}