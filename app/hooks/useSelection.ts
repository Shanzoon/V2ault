'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { SELECTION_LIMITS } from '../lib/constants';

export function useSelection() {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<number>>(new Set());
  // 用于防止重复显示 toast
  const hasShownLimitToastRef = useRef(false);

  const toggleSelection = useCallback((id: number) => {
    setSelectedImageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
        hasShownLimitToastRef.current = false; // 删除时重置
      } else {
        // 检查是否达到上限
        if (newSet.size >= SELECTION_LIMITS.MAX_SELECTION) {
          if (!hasShownLimitToastRef.current) {
            toast.warning(`最多只能选择 ${SELECTION_LIMITS.MAX_SELECTION} 张图片`);
            hasShownLimitToastRef.current = true;
          }
          return prev;
        }
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedImageIds(new Set());
    hasShownLimitToastRef.current = false;
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => !prev);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedImageIds(new Set());
    hasShownLimitToastRef.current = false;
  }, []);

  // 批量设置选中项（用于框选）- 带上限限制
  const setSelectedIds = useCallback((ids: Set<number>) => {
    if (ids.size > SELECTION_LIMITS.MAX_SELECTION) {
      // 只取前 MAX_SELECTION 个
      const limitedIds = new Set(Array.from(ids).slice(0, SELECTION_LIMITS.MAX_SELECTION));
      setSelectedImageIds(limitedIds);
      if (!hasShownLimitToastRef.current) {
        toast.warning(`最多只能选择 ${SELECTION_LIMITS.MAX_SELECTION} 张图片`);
        hasShownLimitToastRef.current = true;
      }
    } else {
      setSelectedImageIds(ids);
      if (ids.size < SELECTION_LIMITS.MAX_SELECTION) {
        hasShownLimitToastRef.current = false;
      }
    }
  }, []);

  return {
    isSelectionMode,
    setIsSelectionMode,
    selectedImageIds,
    setSelectedIds,
    toggleSelection,
    clearSelection,
    toggleSelectionMode,
    exitSelectionMode,
  };
}
