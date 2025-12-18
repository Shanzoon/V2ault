'use client';

import { useEffect, RefObject } from 'react';

/**
 * 点击外部区域时触发回调
 * @param ref - 需要监测的元素引用
 * @param handler - 点击外部时的回调函数
 * @param enabled - 是否启用监听（默认 true）
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, handler, enabled]);
}
