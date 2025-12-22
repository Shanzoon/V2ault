'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { useDebounce } from 'use-debounce';
import type { Image, ApiResponse, SortMode } from '../types';
import type { StyleSource } from '../lib/constants';

// 错误类型定义
export interface ApiError {
  code: 'DB_NOT_FOUND' | 'DB_NOT_INITIALIZED' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';
  message: string;
}

// 风格聚合类型
export type AvailableStyles = Record<StyleSource, string[]>;

// SWR 风格的内存缓存
interface CacheEntry {
  data: ApiResponse;
  timestamp: number;
}
const imageCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30秒缓存有效期

interface UseImagesOptions {
  limit?: number;
}

export function useImages(options: UseImagesOptions = {}) {
  const { limit = 50 } = options;

  const [images, setImages] = useState<Image[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 500);

  const [sortMode, setSortMode] = useState<SortMode>('random_shuffle');
  const [selectedResolutions, setSelectedResolutions] = useState<string[]>([]);
  const [likedOnly, setLikedOnly] = useState(false);

  // 刷新触发器（用于强制重新加载）
  const [refreshKey, setRefreshKey] = useState(0);

  // 新增筛选状态
  const [selectedModelBases, setSelectedModelBases] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [activeStyleTab, setActiveStyleTab] = useState<StyleSource>('2D');

  const abortControllerRef = useRef<AbortController | null>(null);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  });

  // Reset logic
  const resetGallery = useCallback(() => {
    setImages([]);
    setPage(1);
    setHasMore(true);
  }, []);

  // Listen for filter changes
  useEffect(() => {
    resetGallery();
  }, [debouncedSearch, selectedResolutions, sortMode, likedOnly, selectedModelBases, selectedStyles, resetGallery]);

  // Fetch Logic with SWR-style caching
  const fetchImages = useCallback(async () => {
    if (!hasMore && page > 1) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 只在首页加载时清除错误（允许重试）
    if (page === 1) {
      setError(null);
    }

    const resolutionsParam = selectedResolutions.length > 0 ? `&resolutions=${selectedResolutions.join(',')}` : '';
    const likedParam = likedOnly ? '&liked=true' : '';
    const modelBasesParam = selectedModelBases.length > 0 ? `&modelBases=${selectedModelBases.join(',')}` : '';
    const stylesParam = selectedStyles.length > 0 ? `&styles=${selectedStyles.join(',')}` : '';
    const url = `/api/images/list?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}&sort=${sortMode}${resolutionsParam}${likedParam}${modelBasesParam}${stylesParam}`;

    // SWR: 先返回缓存数据（stale）
    const cacheKey = url;
    const cached = imageCache.get(cacheKey);
    if (cached && page === 1) {
      // 立即显示缓存数据
      setTotalAssets(cached.data.total);
      setImages(cached.data.images);
      // 如果缓存未过期，跳过网络请求
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);

    try {
      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) {
        // 尝试解析错误响应
        const errorData = await res.json().catch(() => ({}));

        if (errorData.code === 'DB_NOT_FOUND' || errorData.code === 'DB_NOT_INITIALIZED') {
          setError({
            code: errorData.code,
            message: errorData.error || '数据库错误',
          });
          setHasMore(false);
          return;
        }

        throw new Error(errorData.error || 'Failed to fetch');
      }

      const data: ApiResponse = await res.json();

      // 缓存第一页数据
      if (page === 1) {
        imageCache.set(cacheKey, { data, timestamp: Date.now() });
      }

      setTotalAssets(data.total);

      setImages(prev => {
        if (page === 1) return data.images;
        const existingIds = new Set(prev.map(img => img.id));
        const newImages = data.images.filter(newImg => !existingIds.has(newImg.id));
        return [...prev, ...newImages];
      });

      if (data.images.length < limit) {
        setHasMore(false);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Fetch aborted');
      } else {
        console.error('Error fetching images:', error);
        // 只在第一页设置错误（避免无限滚动时的错误覆盖）
        if (page === 1) {
          setError({
            code: 'NETWORK_ERROR',
            message: error instanceof Error ? error.message : '网络请求失败',
          });
          setHasMore(false);
        }
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, [page, debouncedSearch, sortMode, selectedResolutions, hasMore, limit, likedOnly, selectedModelBases, selectedStyles, refreshKey]);

  // Trigger fetch
  useEffect(() => {
    fetchImages();
  }, [page, fetchImages]);

  // Infinite Scroll
  useEffect(() => {
    if (inView && !isLoading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [inView, isLoading, hasMore]);

  const toggleResolution = useCallback((res: string) => {
    setSelectedResolutions(prev =>
      prev.includes(res) ? prev.filter(r => r !== res) : [...prev, res]
    );
  }, []);

  // 切换模型基底选中状态
  const toggleModelBase = useCallback((modelBase: string) => {
    setSelectedModelBases(prev =>
      prev.includes(modelBase) ? prev.filter(m => m !== modelBase) : [...prev, modelBase]
    );
  }, []);

  // 切换风格选中状态
  const toggleStyle = useCallback((style: string) => {
    setSelectedStyles(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
  }, []);

  // 注意：availableStyles 已移至独立的 useStyles Hook
  // 这样可以在应用启动时获取全局风格列表，而不是只从已加载的图片中计算

  const shuffleImages = useCallback(async () => {
    // 调用后端 API 重新打乱随机顺序
    try {
      await fetch('/api/images/shuffle', { method: 'POST' });
    } catch (e) {
      console.error('Shuffle failed:', e);
    }
    // 清除缓存并刷新
    imageCache.clear();
    setSortMode('random_shuffle');
    resetGallery();
  }, [resetGallery]);

  const updateImage = useCallback((updatedImage: Image) => {
    setImages(prev => prev.map(img => img.id === updatedImage.id ? updatedImage : img));
  }, []);

  // 批量更新图片字段（用于乐观更新）
  const updateImages = useCallback((ids: Set<number>, updates: Partial<Image>) => {
    setImages(prev => prev.map(img => {
      if (ids.has(img.id)) {
        return { ...img, ...updates };
      }
      return img;
    }));
  }, []);

  const removeImage = useCallback((id: number) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  const removeImages = useCallback((ids: Set<number>) => {
    setImages(prev => prev.filter(img => !ids.has(img.id)));
  }, []);

  // 恢复单张图片（用于撤销删除）- 插入到原位置附近
  const restoreImage = useCallback((image: Image, nearId?: number) => {
    setImages(prev => {
      if (nearId) {
        const nearIndex = prev.findIndex(img => img.id === nearId);
        if (nearIndex !== -1) {
          const newImages = [...prev];
          newImages.splice(nearIndex, 0, image);
          return newImages;
        }
      }
      // 默认插入到开头
      return [image, ...prev];
    });
  }, []);

  // 批量恢复图片（用于撤销删除）
  const restoreImages = useCallback((imagesToRestore: Image[]) => {
    setImages(prev => [...imagesToRestore, ...prev]);
  }, []);

  const toggleLiked = useCallback(async (id: number) => {
    // Optimistic update
    setImages(prev => prev.map(img => {
      if (img.id === id) {
        return { ...img, like_count: img.like_count && img.like_count > 0 ? 0 : 1 };
      }
      return img;
    }));

    try {
      const res = await fetch(`/api/images/${id}/liked`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to toggle liked');
      const data = await res.json();

      // Sync with server response
      setImages(prev => prev.map(img => {
        if (img.id === id) {
           return { ...img, like_count: data.liked ? 1 : 0 };
        }
        return img;
      }));
    } catch (error) {
      console.error('Error toggling liked:', error);
      // Revert optimistic update
      setImages(prev => prev.map(img => {
        if (img.id === id) {
          // Flip back
          return { ...img, like_count: img.like_count && img.like_count > 0 ? 0 : 1 };
        }
        return img;
      }));
    }
  }, []);

  // Refetch from the beginning (used after upload)
  const refetch = useCallback(() => {
    // 清除缓存
    imageCache.clear();
    // 重置分页和加载状态
    setPage(1);
    setHasMore(true);
    // 通过 refreshKey 强制触发重新加载
    setRefreshKey(k => k + 1);
  }, []);

  return {
    // Data
    images,  // 直接返回 images（已由服务端过滤）
    totalAssets,
    isLoading,
    hasMore,
    loadMoreRef,
    error,

    // Search & Filter
    search,
    debouncedSearch,
    setSearch,
    selectedResolutions,
    toggleResolution,
    likedOnly,
    setLikedOnly,

    // Model Base Filter
    selectedModelBases,
    toggleModelBase,

    // Style Filter
    selectedStyles,
    toggleStyle,
    activeStyleTab,
    setActiveStyleTab,

    // Sort
    sortMode,
    setSortMode,
    shuffleImages,

    // Actions
    updateImage,
    updateImages,
    removeImage,
    removeImages,
    restoreImage,
    restoreImages,
    toggleLiked,
    refetch,
  };
}
