'use client';

import { AnimatePresence } from 'framer-motion';
import type { Image, GridSize } from '../types';
import { ImageCard } from './ImageCard';

interface ImageGridProps {
  images: Image[];
  isLoading: boolean;
  hasMore: boolean;
  gridSize: GridSize;
  isSelectionMode: boolean;
  selectedImageIds: Set<number>;
  onToggleSelection: (id: number) => void;
  onImageClick: (img: Image) => void;
  onToggleLiked: (id: number) => void;
  loadMoreRef: (node?: Element | null) => void;
}

export function ImageGrid({
  images,
  isLoading,
  hasMore,
  gridSize,
  isSelectionMode,
  selectedImageIds,
  onToggleSelection,
  onImageClick,
  onToggleLiked,
  loadMoreRef,
}: ImageGridProps) {
  const getGridClasses = () => {
    switch (gridSize) {
      case 'small':
        return 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-0.5';
      case 'large':
        return 'grid-cols-1 md:grid-cols-2 gap-2';
      case 'medium':
      default:
        return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1';
    }
  };

  return (
    <>
      {/* Loading Initial (Skeleton) */}
      {isLoading && images.length === 0 ? (
        <div className={`w-full px-2 md:px-12 2xl:max-w-[1800px] grid ${getGridClasses()} auto-rows-min grid-flow-dense`}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="relative bg-white/5 overflow-hidden animate-pulse col-span-1 row-span-1 aspect-square rounded-xl"
            >
              <div className="absolute inset-0 bg-white/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className={`w-full px-2 md:px-12 2xl:max-w-[1800px] grid ${getGridClasses()} auto-rows-min grid-flow-dense`}>
          <AnimatePresence mode="popLayout">
            {images.map((img) => (
              <ImageCard
                key={img.id}
                img={img}
                isSelectionMode={isSelectionMode}
                isSelected={selectedImageIds.has(img.id)}
                onToggleSelection={onToggleSelection}
                onImageClick={onImageClick}
                onToggleLiked={onToggleLiked}
                gridSize={gridSize}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Load More Trigger */}
      <div ref={loadMoreRef} className="w-full py-20 flex justify-center items-center">
        {isLoading && images.length > 0 && (
          <div className="w-8 h-8 border-2 border-white/20 border-t-cyan-500 rounded-full animate-spin"></div>
        )}
        {!hasMore && images.length > 0 && (
          <span className="text-[10px] font-bold text-gray-700 uppercase tracking-[0.3em]">End of Vault</span>
        )}
      </div>
    </>
  );
}
