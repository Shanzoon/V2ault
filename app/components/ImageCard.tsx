'use client';

import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare } from 'lucide-react';
import type { ImageCardProps } from '../types';

export const ImageCard = memo(function ImageCard({
  img,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  onImageClick,
  gridSize,
}: ImageCardProps) {
  const ratio = img.width / img.height;
  let spanClass = 'col-span-1 row-span-1';
  let aspectClass = 'aspect-square';

  if (ratio > 1.2) {
    spanClass = 'col-span-2 row-span-1';
    aspectClass = 'aspect-[2/1]';
  } else if (ratio < 0.8) {
    spanClass = 'col-span-1 row-span-2';
    aspectClass = 'aspect-[1/2]';
  }

  // Progressive Loading URLs
  const tinyUrl = `/api/image/${img.id}?w=50`;
  const smallUrl = `/api/image/${img.id}?w=600`;
  const largeUrl = `/api/image/${img.id}?w=1600`;

  const [smallLoaded, setSmallLoaded] = useState(false);
  const [largeLoaded, setLargeLoaded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.3 }}
      className={`relative group bg-gray-900 overflow-hidden ${spanClass} ${
        isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-black' : ''
      }`}
      onClick={() => {
        if (isSelectionMode) {
          onToggleSelection(img.id);
        } else {
          onImageClick(img);
        }
      }}
    >
      {isSelectionMode && (
        <div
          className={`absolute top-3 right-3 z-20 w-5 h-5 rounded border shadow-sm flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-black/40 border-white/60 hover:bg-black/60'
          }`}
        >
          {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
        </div>
      )}

      <div className={`w-full h-full relative bg-gray-800 ${aspectClass}`}>
        {/* Layer 1: Tiny Placeholder (Blur) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tinyUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-50"
          aria-hidden="true"
        />

        {/* Layer 2: Small Image (Base) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={smallUrl}
          alt={img.filename}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            smallLoaded ? 'opacity-100' : 'opacity-0'
          } transition-transform duration-700 group-hover:scale-105`}
          loading="lazy"
          decoding="async"
          onLoad={() => setSmallLoaded(true)}
        />

        {/* Layer 3: Large Image (High Res) */}
        {gridSize === 'large' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={largeUrl}
            alt={img.filename}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              largeLoaded ? 'opacity-100' : 'opacity-0'
            } transition-transform duration-700 group-hover:scale-105`}
            loading="lazy"
            decoding="async"
            onLoad={() => setLargeLoaded(true)}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent hidden md:block opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 md:translate-y-2 md:group-hover:translate-y-0 opacity-0 md:group-hover:opacity-100 transition-all duration-300 hidden md:block">
          <p className="text-[10px] md:text-xs text-gray-300 line-clamp-2 leading-relaxed">
            {img.filename}
          </p>
        </div>
      </div>
    </motion.div>
  );
}, (prev, next) => {
  return (
    prev.img.id === next.img.id &&
    prev.isSelectionMode === next.isSelectionMode &&
    prev.isSelected === next.isSelected &&
    prev.gridSize === next.gridSize
  );
});
