'use client';

interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface BoxSelectionState {
  isSelecting: boolean;
  selectionRect: SelectionRect | null;
}

interface SelectionBoxProps {
  selectionBox: BoxSelectionState;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

export function SelectionBox({ selectionBox, scrollContainerRef }: SelectionBoxProps) {
  const { isSelecting, selectionRect } = selectionBox;

  if (!isSelecting || !selectionRect || !scrollContainerRef.current) return null;

  const container = scrollContainerRef.current;
  const containerRect = container.getBoundingClientRect();
  const scrollTop = container.scrollTop;

  // 将选择框坐标从容器内容坐标转换为视口坐标
  const viewportLeft = containerRect.left + selectionRect.left;
  const viewportTop = containerRect.top + selectionRect.top - scrollTop;

  // 裁剪到容器可见区域
  const clippedLeft = Math.max(viewportLeft, containerRect.left);
  const clippedTop = Math.max(viewportTop, containerRect.top);
  const clippedRight = Math.min(viewportLeft + selectionRect.width, containerRect.right);
  const clippedBottom = Math.min(viewportTop + selectionRect.height, containerRect.bottom);

  const clippedWidth = Math.max(0, clippedRight - clippedLeft);
  const clippedHeight = Math.max(0, clippedBottom - clippedTop);

  if (clippedWidth === 0 || clippedHeight === 0) return null;

  return (
    <div
      className="fixed pointer-events-none z-[60]"
      style={{
        left: clippedLeft,
        top: clippedTop,
        width: clippedWidth,
        height: clippedHeight,
        border: '2px solid rgb(249 115 22)', // orange-500
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
        borderRadius: '4px',
      }}
    />
  );
}
