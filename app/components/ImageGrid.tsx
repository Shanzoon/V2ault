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
  onDownload: (id: number, filename: string) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
  isAdmin: boolean;
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
  onDownload,
  onDelete,
  isAdmin,
  loadMoreRef,
}: ImageGridProps) {
  const getGridClasses = () => {
    switch (gridSize) {
      case 'small':
        return 'grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-1';
      case 'large':
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1';
      case 'medium':
      default:
        return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1';
    }
  };

  return (
    <>
      {/* Loading Initial (Skeleton) */}
      {isLoading && images.length === 0 ? (
        <div className={`w-full mx-auto md:ml-[80px]  // 仅md及以上屏幕加80px左外边距，手机端无
                px-4 md:px-16 lg:px-20 2xl:max-w-[1650px] 
                grid ${getGridClasses()} auto-rows-min grid-flow-dense`}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="relative border border-orange-300/40 overflow-hidden animate-pulse col-span-1 row-span-1 aspect-square rounded-xl"
            />
          ))}
        </div>
      ) : (
        <div className={`w-full mx-auto md:ml-[80px]  // 仅md及以上屏幕加80px左外边距，手机端无
                px-4 md:px-16 lg:px-20 2xl:max-w-[1650px] 
                grid ${getGridClasses()} auto-rows-min grid-flow-dense`}>
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
                onDownload={onDownload}
                onDelete={onDelete}
                isAdmin={isAdmin}
                loadHighRes={gridSize === 'large'}
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
