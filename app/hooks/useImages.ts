'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { useDebounce } from 'use-debounce';
import type { Image, ApiResponse, SortMode } from '../types';

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

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 500);

  const [sortMode, setSortMode] = useState<SortMode>('random_shuffle');
  const [randomSeed, setRandomSeed] = useState<number | null>(null);
  const [selectedResolutions, setSelectedResolutions] = useState<string[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  });

  // Client-side seed initialization
  useEffect(() => {
    setRandomSeed(Math.floor(Math.random() * 1000000));
  }, []);

  // Reset logic
  const resetGallery = useCallback(() => {
    setImages([]);
    setPage(1);
    setHasMore(true);
  }, []);

  // Listen for filter changes
  useEffect(() => {
    resetGallery();
  }, [debouncedSearch, selectedResolutions, sortMode, randomSeed, resetGallery]);

  // Fetch Logic
  const fetchImages = useCallback(async () => {
    if (sortMode.startsWith('random') && randomSeed === null) return;
    if (!hasMore && page > 1) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);

    try {
      const resolutionsParam = selectedResolutions.length > 0 ? `&resolutions=${selectedResolutions.join(',')}` : '';
      const seedParam = sortMode.startsWith('random') && randomSeed !== null ? `&seed=${randomSeed}` : '';

      const url = `/api/images/list?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}&sort=${sortMode}${resolutionsParam}${seedParam}`;

      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to fetch');

      const data: ApiResponse = await res.json();

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
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, [page, debouncedSearch, sortMode, selectedResolutions, randomSeed, hasMore, limit]);

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

  const shuffleImages = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 1000000);
    setRandomSeed(newSeed);
    setSortMode('random_shuffle');
  }, []);

  const updateImage = useCallback((updatedImage: Image) => {
    setImages(prev => prev.map(img => img.id === updatedImage.id ? updatedImage : img));
  }, []);

  const removeImage = useCallback((id: number) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  const removeImages = useCallback((ids: Set<number>) => {
    setImages(prev => prev.filter(img => !ids.has(img.id)));
  }, []);

  return {
    // Data
    images,
    totalAssets,
    isLoading,
    hasMore,
    loadMoreRef,

    // Search & Filter
    search,
    setSearch,
    selectedResolutions,
    toggleResolution,

    // Sort
    sortMode,
    setSortMode,
    randomSeed,
    setRandomSeed,
    shuffleImages,

    // Actions
    updateImage,
    removeImage,
    removeImages,
    refetch: fetchImages,
  };
}
