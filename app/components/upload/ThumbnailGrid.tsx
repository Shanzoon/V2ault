'use client';

import { forwardRef } from 'react';
import { Upload, Trash2, GripVertical, CheckSquare } from 'lucide-react';
import type { FileWithPreview } from '../../hooks/useUploadModal';

interface ThumbnailGridProps {
  files: FileWithPreview[];
  selectedFileId: string | null;
  selectedFileIds: Set<string>;
  draggedFileId: string | null;
  dragOverFileId: string | null;
  isLoadingFiles: boolean;
  loadingProgress: { current: number; total: number };
  onThumbnailClick: (fileId: string, e: React.MouseEvent) => void;
  onRemoveFile: (id: string) => void;
  onToggleSelectAll: () => void;
  onRemoveSelected: () => void;
  onClickAdd: () => void;
  onDragStartSort: (e: React.DragEvent, fileId: string) => void;
  onDragOverSort: (e: React.DragEvent, fileId: string) => void;
  onDragLeaveSort: () => void;
  onDropSort: (e: React.DragEvent, targetId: string) => void;
  onDragEndSort: () => void;
}

export const ThumbnailGrid = forwardRef<HTMLDivElement, ThumbnailGridProps>(
  function ThumbnailGrid(
    {
      files,
      selectedFileId,
      selectedFileIds,
      draggedFileId,
      dragOverFileId,
      isLoadingFiles,
      loadingProgress,
      onThumbnailClick,
      onRemoveFile,
      onToggleSelectAll,
      onRemoveSelected,
      onClickAdd,
      onDragStartSort,
      onDragOverSort,
      onDragLeaveSort,
      onDropSort,
      onDragEndSort,
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        className="h-[360px] border-t border-white/[0.08] p-3 bg-black/20 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {/* 操作栏 */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSelectAll}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all duration-200 ${
                selectedFileIds.size === files.length && files.length > 0
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                  : 'bg-white/[0.03] text-gray-500 border border-white/[0.06] hover:bg-white/[0.06] hover:text-gray-300'
              }`}
            >
              <CheckSquare className="w-3 h-3" />
              {selectedFileIds.size === files.length && files.length > 0 ? '取消全选' : '全选'}
            </button>
            {selectedFileIds.size > 0 && (
              <>
                <span className="text-[10px] text-gray-500">
                  已选 {selectedFileIds.size} 张
                </span>
                <button
                  onClick={onRemoveSelected}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all duration-200"
                >
                  <Trash2 className="w-3 h-3" />
                  删除
                </button>
              </>
            )}
          </div>
          <span className="text-[10px] text-gray-600">
            方向键导航 · Ctrl+A全选 · Delete删除 · 拖拽排序
          </span>
        </div>

        <div className="grid grid-cols-8 gap-0.5">
          {/* 上传按钮 - 常驻第一位 */}
          <div
            onClick={onClickAdd}
            className="aspect-square rounded-xl border-2 border-dashed border-white/15 hover:border-orange-500/40
              flex flex-col items-center justify-center cursor-pointer transition-all duration-200
              hover:bg-orange-500/5 group"
          >
            <Upload className="w-5 h-5 text-gray-500 group-hover:text-orange-400 transition-colors mb-1" />
            <span className="text-[10px] text-gray-600 group-hover:text-orange-400/80">添加</span>
          </div>

          {/* 缩略图列表 */}
          {files.map((f) => {
            const isSelected = selectedFileId === f.id;
            const isMultiSelected = selectedFileIds.has(f.id);
            const isDragging = draggedFileId === f.id;
            const isDragOver = dragOverFileId === f.id;

            return (
              <div
                key={f.id}
                onClick={(e) => onThumbnailClick(f.id, e)}
                draggable
                onDragStart={(e) => onDragStartSort(e, f.id)}
                onDragOver={(e) => onDragOverSort(e, f.id)}
                onDragLeave={onDragLeaveSort}
                onDrop={(e) => onDropSort(e, f.id)}
                onDragEnd={onDragEndSort}
                className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'ring-2 ring-orange-500 ring-offset-1 ring-offset-[#0d0d0d] scale-[0.95]'
                    : isMultiSelected
                    ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-[#0d0d0d] scale-[0.95]'
                    : 'hover:ring-1 hover:ring-white/30 hover:scale-[0.97]'
                } ${isDragging ? 'opacity-50 scale-[0.9]' : ''} ${
                  isDragOver ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-[#0d0d0d]' : ''
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.preview}
                  alt={f.metadata.title}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                {/* 选中指示器 */}
                {isSelected && (
                  <div className="absolute inset-0 bg-orange-500/10 pointer-events-none" />
                )}
                {/* 多选指示器 */}
                {isMultiSelected && (
                  <div className="absolute top-1 left-1 p-0.5 bg-blue-500 rounded-md">
                    <CheckSquare className="w-3 h-3 text-white" />
                  </div>
                )}
                {/* 必填未填红点提示 */}
                {(!f.metadata.model_base || !f.metadata.source) && (
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                )}
                {/* 拖拽手柄 */}
                <div className="absolute bottom-1 left-1 p-0.5 bg-black/50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                  <GripVertical className="w-3 h-3 text-white/70" />
                </div>
                {/* 删除按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFile(f.id);
                  }}
                  className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-red-500/90 text-white/70 hover:text-white rounded-md transition-all duration-200 opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* 加载中的骨架屏占位符 */}
          {isLoadingFiles && loadingProgress.total > files.length &&
            Array.from({ length: Math.min(loadingProgress.total - files.length, 23) }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="aspect-square rounded-xl bg-white/[0.03] animate-pulse"
              />
            ))
          }
        </div>
      </div>
    );
  }
);
