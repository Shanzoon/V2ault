'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AvailableStyles } from './useImages';

export function useStyles() {
  const [availableStyles, setAvailableStyles] = useState<AvailableStyles>({
    '2D': [],
    '3D': [],
    'Real': []
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStyles = useCallback(async () => {
    try {
      const res = await fetch('/api/styles');
      if (res.ok) {
        const data = await res.json();
        setAvailableStyles(data);
      }
    } catch (error) {
      console.error('Failed to fetch styles:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化时获取风格列表
  useEffect(() => {
    fetchStyles();
  }, [fetchStyles]);

  // 提供刷新方法，上传新图片后调用
  const refetchStyles = useCallback(async () => {
    try {
      const res = await fetch('/api/styles');
      if (res.ok) {
        const data = await res.json();
        setAvailableStyles(data);
      }
    } catch (error) {
      console.error('Failed to refetch styles:', error);
    }
  }, []);

  return { availableStyles, isLoading, refetchStyles };
}
