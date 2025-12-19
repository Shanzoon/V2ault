'use client';

import { AnimatePresence } from 'framer-motion';
import type { Image } from '../types';
import { TrashImageCard } from './TrashImageCard';

interface TrashImageGridProps {
  images: Image[];
  isLoading: boolean;
  hasMore: boolean;
  isSelectionMode: boolean;
  selectedImageIds: Set<number>;
  onToggleSelection: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
  isAdmin: boolean;
  loadMoreRef: (node?: Element | null) => void;
}

export function TrashImageGrid({
  images,
  isLoading,
  hasMore,
  isSelectionMode,
  selectedImageIds,
  onToggleSelection,
  onRestore,
  onDelete,
  isAdmin,
  loadMoreRef,
}: TrashImageGridProps) {
  const gridClasses = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3';

  return (
    <>
      {/* Loading Initial (Skeleton) */}
      {isLoading && images.length === 0 ? (
        <div className={`grid ${gridClasses}`}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="relative overflow-hidden animate-pulse aspect-square rounded-lg bg-white/5"
            />
          ))}
        </div>
      ) : (
        <div className={`grid ${gridClasses}`}>
          <AnimatePresence mode="sync">
            {images.map((img) => (
              <TrashImageCard
                key={img.id}
                img={img}
                isSelectionMode={isSelectionMode}
                isSelected={selectedImageIds.has(img.id)}
                onToggleSelection={onToggleSelection}
                onRestore={onRestore}
                onDelete={onDelete}
                isAdmin={isAdmin}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Load More Trigger */}
      <div ref={loadMoreRef} className="w-full py-12 flex justify-center items-center">
        {isLoading && images.length > 0 && (
          <div className="w-8 h-8 border-2 border-white/20 border-t-red-500 rounded-full animate-spin" />
        )}
        {!hasMore && images.length > 0 && (
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.3em]">
            回收站末尾
          </span>
        )}
      </div>
    </>
  );
}
