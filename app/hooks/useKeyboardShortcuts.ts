'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Image, GridSize } from '../types';
import type { StyleSource } from '../lib/constants';
import { STYLE_SOURCES } from '../lib/constants';

// 缩略图尺寸循环顺序
const GRID_SIZE_CYCLE: GridSize[] = ['small', 'medium', 'large'];
const GRID_SIZE_NAMES = {
  small: '小',
  medium: '中',
  large: '大',
};

// 快捷键配置
const SHORTCUTS = {
  GRID_CYCLE: 'q',
  SHUFFLE: 'r',
  STYLE_PREV: '[',
  STYLE_NEXT: ']',
  STYLE_ITEM_PREV: 'w',
  STYLE_ITEM_NEXT: 'e',
  HELP: '?',
  DELETE: 'Delete',
  ESCAPE: 'Escape',
  PREV_IMAGE: 'ArrowLeft',
  NEXT_IMAGE: 'ArrowRight',
} as const;

interface UseKeyboardShortcutsOptions {
  selectedImage: Image | null;
  isFullscreen: boolean;
  isEditingPrompt: boolean;
  isSelectionMode: boolean;
  selectedImageIds: Set<number>;
  images: Image[];
  gridSize: GridSize;
  activeStyleTab: StyleSource;
  availableStyles: Record<StyleSource, string[]>;
  selectedStyle: string | null;
  setGridSize: (size: GridSize) => void;
  setIsFullscreen: (value: boolean) => void;
  setSelectedImage: (img: Image | null) => void;
  setIsEditingPrompt: (value: boolean) => void;
  setIsSelectionMode: (value: boolean) => void;
  setActiveStyleTab: (tab: StyleSource) => void;
  selectStyle: (style: string | null) => void;
  clearSelection: () => void;
  onBatchDelete: () => void;
  onSingleDelete: () => void;
  onTitleClick: () => void;
  // 视觉反馈回调
  onGridKeyPress?: () => void;
  onShuffleKeyPress?: () => void;
}

export function useKeyboardShortcuts({
  selectedImage,
  isFullscreen,
  isEditingPrompt,
  isSelectionMode,
  selectedImageIds,
  images,
  gridSize,
  activeStyleTab,
  availableStyles,
  selectedStyle,
  setGridSize,
  setIsFullscreen,
  setSelectedImage,
  setIsEditingPrompt,
  setIsSelectionMode,
  setActiveStyleTab,
  selectStyle,
  clearSelection,
  onBatchDelete,
  onSingleDelete,
  onTitleClick,
  onGridKeyPress,
  onShuffleKeyPress,
}: UseKeyboardShortcutsOptions) {
  // 防抖：防止快速切换视角
  const lastGridChangeRef = useRef<number>(0);
  const GRID_CHANGE_DEBOUNCE = 200; // ms

  // 帮助面板状态
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handleNextImage = useCallback(() => {
    if (!selectedImage) return;
    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    if (currentIndex !== -1 && currentIndex < images.length - 1) {
      setSelectedImage(images[currentIndex + 1]);
    }
  }, [selectedImage, images, setSelectedImage]);

  const handlePrevImage = useCallback(() => {
    if (!selectedImage) return;
    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    if (currentIndex > 0) {
      setSelectedImage(images[currentIndex - 1]);
    }
  }, [selectedImage, images, setSelectedImage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入框中，不触发（除了 ESC）
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (isTyping && e.key !== SHORTCUTS.ESCAPE) return;

      // 帮助面板快捷键
      if (e.key === SHORTCUTS.HELP && !isTyping) {
        e.preventDefault();
        setIsHelpOpen(prev => !prev);
        return;
      }

      // ESC 关闭帮助面板
      if (e.key === SHORTCUTS.ESCAPE && isHelpOpen) {
        setIsHelpOpen(false);
        return;
      }

      // 帮助面板打开时阻止其他快捷键
      if (isHelpOpen) return;

      // 全局快捷键（不在编辑状态且没有打开 Modal）
      if (!isEditingPrompt && !selectedImage) {
        const now = Date.now();
        const key = e.key.toLowerCase();

        // Q: 循环切换布局
        if (key === SHORTCUTS.GRID_CYCLE) {
          if (now - lastGridChangeRef.current < GRID_CHANGE_DEBOUNCE) return;
          lastGridChangeRef.current = now;
          const currentIndex = GRID_SIZE_CYCLE.indexOf(gridSize);
          const nextIndex = (currentIndex + 1) % GRID_SIZE_CYCLE.length;
          const nextSize = GRID_SIZE_CYCLE[nextIndex];
          setGridSize(nextSize);
          onGridKeyPress?.();
          toast(`布局: ${GRID_SIZE_NAMES[nextSize]}`);
          return;
        }

        // R: 随机排列
        if (key === SHORTCUTS.SHUFFLE) {
          onShuffleKeyPress?.();
          onTitleClick();
          toast('已随机排列');
          return;
        }

        // [ : 上一个风格大类
        if (e.key === SHORTCUTS.STYLE_PREV) {
          const currentIndex = STYLE_SOURCES.indexOf(activeStyleTab);
          const prevIndex = (currentIndex - 1 + STYLE_SOURCES.length) % STYLE_SOURCES.length;
          setActiveStyleTab(STYLE_SOURCES[prevIndex]);
          toast(`风格: ${STYLE_SOURCES[prevIndex]}`);
          return;
        }

        // ] : 下一个风格大类
        if (e.key === SHORTCUTS.STYLE_NEXT) {
          const currentIndex = STYLE_SOURCES.indexOf(activeStyleTab);
          const nextIndex = (currentIndex + 1) % STYLE_SOURCES.length;
          setActiveStyleTab(STYLE_SOURCES[nextIndex]);
          toast(`风格: ${STYLE_SOURCES[nextIndex]}`);
          return;
        }

        // W: 上一个具体风格
        if (key === SHORTCUTS.STYLE_ITEM_PREV) {
          const styles = availableStyles[activeStyleTab] || [];
          if (styles.length === 0) return;
          const currentIndex = selectedStyle ? styles.indexOf(selectedStyle) : -1;
          if (currentIndex <= 0) {
            // 当前无选中或已是第一个，取消选中
            selectStyle(null);
            toast(`${activeStyleTab}: 全部`);
          } else {
            const prevStyle = styles[currentIndex - 1];
            selectStyle(prevStyle);
            toast(`${activeStyleTab}: ${prevStyle}`);
          }
          return;
        }

        // E: 下一个具体风格
        if (key === SHORTCUTS.STYLE_ITEM_NEXT) {
          const styles = availableStyles[activeStyleTab] || [];
          if (styles.length === 0) return;
          const currentIndex = selectedStyle ? styles.indexOf(selectedStyle) : -1;
          if (currentIndex === -1) {
            // 当前无选中，选第一个
            selectStyle(styles[0]);
            toast(`${activeStyleTab}: ${styles[0]}`);
          } else if (currentIndex < styles.length - 1) {
            const nextStyle = styles[currentIndex + 1];
            selectStyle(nextStyle);
            toast(`${activeStyleTab}: ${nextStyle}`);
          }
          return;
        }
      }

      // Delete 键删除
      if (e.key === SHORTCUTS.DELETE) {
        if (isSelectionMode && selectedImageIds.size > 0) {
          onBatchDelete();
        } else if (selectedImage) {
          onSingleDelete();
        }
        return;
      }

      // ESC to exit selection mode
      if (e.key === SHORTCUTS.ESCAPE && isSelectionMode && !selectedImage) {
        setIsSelectionMode(false);
        clearSelection();
        toast('已退出多选模式');
        return;
      }

      if (!selectedImage) return;

      if (isEditingPrompt) {
        if (e.key === SHORTCUTS.ESCAPE) setIsEditingPrompt(false);
        return;
      }

      if (e.key === SHORTCUTS.ESCAPE) {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          setSelectedImage(null);
        }
      } else if (e.key === SHORTCUTS.PREV_IMAGE) {
        handlePrevImage();
      } else if (e.key === SHORTCUTS.NEXT_IMAGE) {
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedImage,
    isFullscreen,
    isEditingPrompt,
    isSelectionMode,
    selectedImageIds,
    gridSize,
    activeStyleTab,
    availableStyles,
    selectedStyle,
    isHelpOpen,
    setGridSize,
    setIsFullscreen,
    setSelectedImage,
    setIsEditingPrompt,
    setIsSelectionMode,
    setActiveStyleTab,
    selectStyle,
    clearSelection,
    onBatchDelete,
    onSingleDelete,
    onTitleClick,
    onGridKeyPress,
    onShuffleKeyPress,
    handleNextImage,
    handlePrevImage,
  ]);

  return {
    handleNextImage,
    handlePrevImage,
    isHelpOpen,
    setIsHelpOpen,
  };
}
