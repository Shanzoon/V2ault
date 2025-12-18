'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { BOX_SELECTION, SELECTION_LIMITS } from '../lib/constants';

interface Point {
  x: number;
  y: number;
}

interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

// 卡片内容坐标（相对于容器内容区域，不随滚动变化）
interface CardContentRect {
  id: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface UseBoxSelectionOptions {
  enabled: boolean;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  cardRects: Map<number, DOMRect>;
  onSelectionChange: (ids: Set<number>) => void;
  setIsSelectionMode: (value: boolean) => void;
  isSelectionMode: boolean;
  hasSelection: boolean;
  clearSelection: () => void;
}

interface BoxSelectionState {
  isSelecting: boolean;
  selectionRect: SelectionRect | null;
}

// 计算选择框矩形
function calculateSelectionRect(start: Point, end: Point): SelectionRect {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    right,
    bottom,
  };
}

// 使用缓存的卡片位置进行碰撞检测
function detectCollisionsWithCache(
  selectionRect: SelectionRect,
  cachedRects: CardContentRect[]
): Set<number> {
  const selectedIds = new Set<number>();

  for (const card of cachedRects) {
    // AABB 碰撞检测
    if (
      selectionRect.left < card.right &&
      selectionRect.right > card.left &&
      selectionRect.top < card.bottom &&
      selectionRect.bottom > card.top
    ) {
      selectedIds.add(card.id);
    }
  }

  return selectedIds;
}

export function useBoxSelection(options: UseBoxSelectionOptions): { selectionBox: BoxSelectionState; isSelecting: boolean } {
  const { enabled, scrollContainerRef, onSelectionChange, setIsSelectionMode, isSelectionMode, hasSelection, clearSelection } = options;

  const [state, setState] = useState<BoxSelectionState>({
    isSelecting: false,
    selectionRect: null,
  });

  // 起始点（相对于容器内容，包括滚动）
  const startPointRef = useRef<Point | null>(null);
  // 起始客户端坐标（用于检测点击 vs 拖拽）
  const startClientRef = useRef<Point | null>(null);
  // 自动滚动定时器
  const autoScrollIntervalRef = useRef<number | null>(null);
  // 当前鼠标位置（用于自动滚动时更新选择框）
  const currentMouseRef = useRef<{ clientX: number; clientY: number } | null>(null);
  // 是否正在选择
  const isSelectingRef = useRef(false);
  // 当前框选中的图片数量（用于判断是否进入多选模式）
  const currentSelectionCountRef = useRef(0);
  // 缓存的卡片内容坐标（框选期间不变）
  const cachedCardRectsRef = useRef<CardContentRect[]>([]);

  // 获取并缓存所有卡片的内容坐标
  const cacheCardRects = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;

    const imageCards = container.querySelectorAll<HTMLElement>('.image-card[data-image-id]');
    const rects: CardContentRect[] = [];

    imageCards.forEach((card) => {
      const imageId = parseInt(card.dataset.imageId || '0', 10);
      if (!imageId) return;

      const cardRect = card.getBoundingClientRect();

      // 转换为相对于容器内容的坐标（不随滚动变化）
      rects.push({
        id: imageId,
        left: cardRect.left - containerRect.left + scrollLeft,
        top: cardRect.top - containerRect.top + scrollTop,
        right: cardRect.right - containerRect.left + scrollLeft,
        bottom: cardRect.bottom - containerRect.top + scrollTop,
      });
    });

    cachedCardRectsRef.current = rects;
  }, [scrollContainerRef]);

  // 停止自动滚动
  const stopAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current !== null) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  }, []);

  // 更新选择框和碰撞检测
  const updateSelection = useCallback(
    (clientX: number, clientY: number) => {
      const container = scrollContainerRef.current;
      if (!container || !startPointRef.current || !isSelectingRef.current) return;

      const containerRect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      const scrollLeft = container.scrollLeft;

      // 当前点（相对于容器内容）
      const currentX = clientX - containerRect.left + scrollLeft;
      const currentY = clientY - containerRect.top + scrollTop;

      // 计算选择框
      const rect = calculateSelectionRect(startPointRef.current, { x: currentX, y: currentY });

      setState((prev) => ({
        ...prev,
        selectionRect: rect,
      }));

      // 使用缓存进行碰撞检测（性能优化）
      const selectedIds = detectCollisionsWithCache(rect, cachedCardRectsRef.current);
      currentSelectionCountRef.current = selectedIds.size;
      onSelectionChange(selectedIds);
    },
    [scrollContainerRef, onSelectionChange]
  );

  // 处理自动滚动
  const handleAutoScroll = useCallback(
    (clientY: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const edgeThreshold = BOX_SELECTION.EDGE_THRESHOLD;
      const scrollSpeed = BOX_SELECTION.SCROLL_SPEED;

      let scrollDelta = 0;

      // 检测是否接近顶部边缘
      if (clientY < containerRect.top + edgeThreshold) {
        scrollDelta = -scrollSpeed;
      }
      // 检测是否接近底部边缘
      else if (clientY > containerRect.bottom - edgeThreshold) {
        scrollDelta = scrollSpeed;
      }

      if (scrollDelta !== 0) {
        // 开始自动滚动
        if (autoScrollIntervalRef.current === null) {
          autoScrollIntervalRef.current = window.setInterval(() => {
            if (!container || !currentMouseRef.current) return;

            container.scrollTop += scrollDelta;

            // 滚动时更新选择框
            updateSelection(currentMouseRef.current.clientX, currentMouseRef.current.clientY);
          }, BOX_SELECTION.FRAME_INTERVAL);
        }
      } else {
        stopAutoScroll();
      }
    },
    [scrollContainerRef, stopAutoScroll, updateSelection]
  );

  useEffect(() => {
    if (!enabled) {
      setState({ isSelecting: false, selectionRect: null });
      stopAutoScroll();
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      // 只响应左键
      if (e.button !== 0) return;

      // 排除点击图片卡片内部和按钮
      const target = e.target as HTMLElement;
      if (
        target.closest('.image-card') ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('input')
      ) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;

      // 起始点（相对于容器内容）
      const startX = e.clientX - containerRect.left;
      const startY = e.clientY - containerRect.top + scrollTop;

      startPointRef.current = { x: startX, y: startY };
      startClientRef.current = { x: e.clientX, y: e.clientY };
      currentMouseRef.current = { clientX: e.clientX, clientY: e.clientY };
      isSelectingRef.current = true;

      // 缓存卡片位置（框选期间保持不变）
      cacheCardRects();

      setState({
        isSelecting: true,
        selectionRect: {
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          right: startX,
          bottom: startY,
        },
      });

      // 重置选中计数
      currentSelectionCountRef.current = 0;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelectingRef.current) return;

      currentMouseRef.current = { clientX: e.clientX, clientY: e.clientY };

      // 更新选择框
      updateSelection(e.clientX, e.clientY);

      // 处理自动滚动
      handleAutoScroll(e.clientY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelectingRef.current) return;

      // 检测是否是"点击"（移动距离小于阈值）
      const isClick = startClientRef.current &&
        Math.abs(e.clientX - startClientRef.current.x) < BOX_SELECTION.CLICK_THRESHOLD &&
        Math.abs(e.clientY - startClientRef.current.y) < BOX_SELECTION.CLICK_THRESHOLD;

      // 保存当前选中数量
      const selectionCount = currentSelectionCountRef.current;

      isSelectingRef.current = false;
      startPointRef.current = null;
      startClientRef.current = null;
      currentMouseRef.current = null;
      currentSelectionCountRef.current = 0;
      stopAutoScroll();

      setState({
        isSelecting: false,
        selectionRect: null,
      });

      // 如果是点击空白处且当前在多选模式下，退出多选模式
      if (isClick && isSelectionMode && hasSelection) {
        clearSelection();
        setIsSelectionMode(false);
      }
      // 如果是拖拽框选且选中了图片，进入多选模式
      else if (!isClick && selectionCount > 0) {
        setIsSelectionMode(true);
      }
    };

    // mousedown 在容器上监听
    container.addEventListener('mousedown', handleMouseDown);
    // mousemove/mouseup 在 window 上监听（防止鼠标移出容器）
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      stopAutoScroll();
    };
  }, [enabled, scrollContainerRef, setIsSelectionMode, updateSelection, handleAutoScroll, stopAutoScroll, isSelectionMode, hasSelection, clearSelection, cacheCardRects]);

  return {
    selectionBox: state,
    isSelecting: state.isSelecting,
  };
}
