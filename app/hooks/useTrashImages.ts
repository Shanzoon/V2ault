'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import type { Image } from '../types';

interface UseTrashImagesOptions {
  limit?: number;
}

export function useTrashImages(options: UseTrashImagesOptions = {}) {
  const { limit = 50 } = options;

  const [images, setImages] = useState<Image[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  });

  // 重置列表
  const resetList = useCallback(() => {
    setImages([]);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, []);

  // 获取回收站数据
  const fetchTrashImages = useCallback(async () => {
    if (!hasMore && page > 1) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    if (page === 1) {
      setError(null);
    }

    try {
      const res = await fetch(`/api/trash?page=${page}&limit=${limit}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch trash');
      }

      const data = await res.json();

      setTotalCount(data.total);

      setImages(prev => {
        if (page === 1) return data.images;
        const existingIds = new Set(prev.map(img => img.id));
        const newImages = data.images.filter(
          (img: Image) => !existingIds.has(img.id)
        );
        return [...prev, ...newImages];
      });

      if (data.images.length < limit) {
        setHasMore(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Fetch aborted');
      } else {
        console.error('Error fetching trash:', err);
        if (page === 1) {
          setError(err instanceof Error ? err.message : '获取回收站失败');
          setHasMore(false);
        }
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, [page, limit, hasMore]);

  // 触发获取
  useEffect(() => {
    fetchTrashImages();
  }, [page, fetchTrashImages]);

  // 无限滚动
  useEffect(() => {
    if (inView && !isLoading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [inView, isLoading, hasMore]);

  // 移除单张图片（乐观更新）
  const removeImage = useCallback((id: number) => {
    setImages(prev => prev.filter(img => img.id !== id));
    setTotalCount(prev => Math.max(0, prev - 1));
  }, []);

  // 批量移除图片（乐观更新）
  const removeImages = useCallback((ids: Set<number>) => {
    setImages(prev => prev.filter(img => !ids.has(img.id)));
    setTotalCount(prev => Math.max(0, prev - ids.size));
  }, []);

  // 刷新列表
  const refetch = useCallback(() => {
    resetList();
  }, [resetList]);

  return {
    images,
    totalCount,
    isLoading,
    hasMore,
    loadMoreRef,
    error,
    refetch,
    removeImage,
    removeImages,
  };
}
