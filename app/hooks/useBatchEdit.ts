'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { StyleSource } from '../lib/constants';
import type { Image } from '../types';

interface UseBatchEditOptions {
  selectedImageIds: Set<number>;
  images: Image[];
  updateImages: (ids: Set<number>, updates: Partial<Image>) => void;
  onStyleChange?: () => void; // 仅在风格变化时刷新风格列表
}

export function useBatchEdit({ selectedImageIds, images, updateImages, onStyleChange }: UseBatchEditOptions) {
  const [isProcessing, setIsProcessing] = useState(false);

  // 批量喜欢
  const batchLike = useCallback(async () => {
    if (selectedImageIds.size === 0) return;

    // 乐观更新
    updateImages(selectedImageIds, { like_count: 1 });

    setIsProcessing(true);
    try {
      const res = await fetch('/api/images/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedImageIds),
          action: 'like',
        }),
      });

      if (!res.ok) throw new Error('Failed to batch like');

      toast.success(`已为 ${selectedImageIds.size} 张图片点赞`);
    } catch (error) {
      console.error('Batch like error:', error);
      // 回滚乐观更新
      updateImages(selectedImageIds, { like_count: 0 });
      toast.error('批量点赞失败');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedImageIds, updateImages]);

  // 批量修改模型
  const batchUpdateModel = useCallback(async (modelBase: string) => {
    if (selectedImageIds.size === 0) return;

    // 保存原始值用于回滚
    const originalValues = new Map<number, string | null>();
    images.filter(img => selectedImageIds.has(img.id)).forEach(img => {
      originalValues.set(img.id, img.model_base || null);
    });

    // 乐观更新
    updateImages(selectedImageIds, { model_base: modelBase });

    setIsProcessing(true);
    try {
      const res = await fetch('/api/images/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedImageIds),
          action: 'update',
          data: { model_base: modelBase },
        }),
      });

      if (!res.ok) throw new Error('Failed to batch update model');

      toast.success(`已修改 ${selectedImageIds.size} 张图片的模型为 ${modelBase}`);
    } catch (error) {
      console.error('Batch update model error:', error);
      // 回滚到原始值
      originalValues.forEach((original, id) => {
        updateImages(new Set([id]), { model_base: original });
      });
      toast.error('批量修改模型失败');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedImageIds, images, updateImages]);

  // 批量修改风格
  const batchUpdateStyle = useCallback(async (source: StyleSource, style: string) => {
    if (selectedImageIds.size === 0) return;

    // 保存原始值用于回滚
    const originalValues = new Map<number, { source: StyleSource | null; style: string | null }>();
    images.filter(img => selectedImageIds.has(img.id)).forEach(img => {
      originalValues.set(img.id, {
        source: (img.source as StyleSource) || null,
        style: img.style || null,
      });
    });

    // 乐观更新
    updateImages(selectedImageIds, { source, style });

    setIsProcessing(true);
    try {
      const res = await fetch('/api/images/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedImageIds),
          action: 'update',
          data: { source, style },
        }),
      });

      if (!res.ok) throw new Error('Failed to batch update style');

      toast.success(`已修改 ${selectedImageIds.size} 张图片的风格为 ${source}/${style}`);
      // 刷新风格列表（可能有新风格）
      onStyleChange?.();
    } catch (error) {
      console.error('Batch update style error:', error);
      // 回滚到原始值
      originalValues.forEach((original, id) => {
        updateImages(new Set([id]), {
          source: original.source as StyleSource,
          style: original.style,
        });
      });
      toast.error('批量修改风格失败');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedImageIds, images, updateImages, onStyleChange]);

  return {
    isProcessing,
    batchLike,
    batchUpdateModel,
    batchUpdateStyle,
  };
}
