'use client';

import { useRef, useEffect, useCallback } from 'react';
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
  onDelete: (id: number) => void;
  isAdmin: boolean;
  loadMoreRef: (node?: Element | null) => void;
  onCardRectsChange?: (rects: Map<number, DOMRect>) => void;
  // 空状态判断
  hasFilters?: boolean;
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
  onCardRectsChange,
  hasFilters = false,
}: ImageGridProps) {
  // 卡片 ref 映射
  const cardRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());

  // 更新卡片位置
  const updateCardRects = useCallback(() => {
    if (!onCardRectsChange) return;

    const rects = new Map<number, DOMRect>();
    cardRefsMap.current.forEach((el, id) => {
      if (el) {
        rects.set(id, el.getBoundingClientRect());
      }
    });
    onCardRectsChange(rects);
  }, [onCardRectsChange]);

  // 设置卡片 ref
  const setCardRef = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) {
      cardRefsMap.current.set(id, el);
    } else {
      cardRefsMap.current.delete(id);
    }
  }, []);

  // 计算 span 类（根据宽高比）
  const getSpanClass = useCallback((img: Image) => {
    const ratio = (img.width && img.height) ? (img.width / img.height) : 1;
    if (ratio > 1.2) return 'col-span-2 row-span-1';
    if (ratio < 0.8) return 'col-span-1 row-span-2';
    return 'col-span-1 row-span-1';
  }, []);

  // 监听布局变化
  useEffect(() => {
    if (!onCardRectsChange) return;

    // 初始更新
    updateCardRects();

    // 使用 ResizeObserver 监听变化
    const observer = new ResizeObserver(() => {
      updateCardRects();
    });

    // 观察所有卡片
    cardRefsMap.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    // 也监听滚动和窗口大小变化
    window.addEventListener('resize', updateCardRects);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateCardRects);
    };
  }, [images, updateCardRects, onCardRectsChange]);

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
      ) : !isLoading && images.length === 0 ? (
        /* 空状态 */
        <div className="w-full flex flex-col items-center justify-center py-32 px-4">
          <div className="w-20 h-20 mb-6 rounded-full bg-white/5 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-400 mb-2">
            {hasFilters ? '没有匹配的图片' : '暂无图片'}
          </h3>
          <p className="text-sm text-gray-600 text-center max-w-xs">
            {hasFilters
              ? '尝试调整筛选条件或搜索关键词'
              : '上传一些图片开始使用吧'
            }
          </p>
        </div>
      ) : (
        <div className={`w-full mx-auto md:ml-[80px]  // 仅md及以上屏幕加80px左外边距，手机端无
                px-4 md:px-16 lg:px-20 2xl:max-w-[1650px]
                grid ${getGridClasses()} auto-rows-min grid-flow-dense`}>
          <AnimatePresence mode="sync">
            {images.map((img) => (
              <div
                key={img.id}
                ref={(el) => setCardRef(img.id, el)}
                data-image-id={img.id}
                className={`image-card ${getSpanClass(img)}`}
              >
                <ImageCard
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
              </div>
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
