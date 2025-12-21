'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { ThumbnailGrid } from './ThumbnailGrid';
import { MetadataEditor } from './MetadataEditor';
import type { FileWithPreview, FileMetadata } from '../../hooks/useUploadModal';
import type { StyleSource } from '../../lib/constants';

const MAX_FILE_COUNT = 500;
const ALLOWED_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif';

interface UploadEditViewProps {
  // File state
  files: FileWithPreview[];
  selectedFile: FileWithPreview | undefined;
  selectedFileId: string | null;
  selectedFileIds: Set<string>;

  // UI state
  isDragOver: boolean;
  isLoadingFiles: boolean;
  loadingProgress: { current: number; total: number };
  showStyleSuggestions: boolean;
  filteredStyles: string[];

  // Drag sort state
  draggedFileId: string | null;
  dragOverFileId: string | null;

  // File operations
  onRemoveFile: (id: string) => void;
  onRemoveSelectedFiles: () => void;

  // Selection operations
  onThumbnailClick: (fileId: string, e: React.MouseEvent) => void;
  onToggleSelectAll: () => void;

  // Drag sort operations
  onDragStartSort: (e: React.DragEvent, fileId: string) => void;
  onDragOverSort: (e: React.DragEvent, fileId: string) => void;
  onDragLeaveSort: () => void;
  onDropSort: (e: React.DragEvent, targetId: string) => void;
  onDragEndSort: () => void;

  // Drag upload operations
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;

  // Metadata operations
  onUpdateMetadata: (id: string, updates: Partial<FileMetadata>) => void;
  onSourceChange: (fileId: string, source: StyleSource) => void;
  onCopyMetadata: () => void;
  onShowStyleSuggestions: (show: boolean) => void;

  // Modal operations
  onClose: () => void;
  onUpload: () => void;
  onFilesSelected: (files: FileList | File[]) => void;
}

export function UploadEditView({
  files,
  selectedFile,
  selectedFileId,
  selectedFileIds,
  isDragOver,
  isLoadingFiles,
  loadingProgress,
  showStyleSuggestions,
  filteredStyles,
  draggedFileId,
  dragOverFileId,
  onRemoveFile,
  onRemoveSelectedFiles,
  onThumbnailClick,
  onToggleSelectAll,
  onDragStartSort,
  onDragOverSort,
  onDragLeaveSort,
  onDropSort,
  onDragEndSort,
  onDragOver,
  onDragLeave,
  onDrop,
  onUpdateMetadata,
  onSourceChange,
  onCopyMetadata,
  onShowStyleSuggestions,
  onClose,
  onUpload,
  onFilesSelected,
}: UploadEditViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative flex flex-col h-full">
      {/* 弹窗头部 */}
      <div className="relative flex items-center justify-between px-8 py-5 border-b border-white/[0.08]">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20">
            <Upload className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              上传图片
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              已选择 <span className="text-orange-400 font-medium">{files.length}</span> / {MAX_FILE_COUNT} 张
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 数量警告 */}
      {files.length >= MAX_FILE_COUNT * 0.9 && (
        <div className="mx-8 mt-4 px-4 py-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center gap-3">
          <div className="p-1.5 bg-amber-500/10 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-sm text-amber-300/80">
            接近数量上限 ({files.length}/{MAX_FILE_COUNT})
          </span>
        </div>
      )}

      {/* 加载进度条 */}
      {isLoadingFiles && (
        <div className="mx-8 mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">正在加载图片...</span>
            <span className="text-xs text-orange-400 font-medium">
              {loadingProgress.current}/{loadingProgress.total}
            </span>
          </div>
          <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        </div>
      )}

      {/* 弹窗内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* ===== 左侧：预览 + 缩略图 ===== */}
        <div
          className={`w-[58%] flex flex-col border-r border-white/[0.08] transition-all duration-300 ${
            isDragOver ? 'bg-orange-500/5 ring-2 ring-inset ring-orange-500/30' : ''
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {/* 大预览图区域 */}
          <div className="flex-1 p-4 pt-3 flex items-start justify-center min-h-0">
            {selectedFile ? (
              <div className="w-full h-full flex items-start justify-center">
                <div className="relative w-full h-full max-h-full rounded-2xl overflow-hidden bg-black/40 ring-1 ring-white/[0.08] flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedFile.preview}
                    alt={selectedFile.metadata.title}
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                  />
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="p-5 bg-white/[0.02] rounded-2xl mx-auto w-fit mb-4">
                    <ImageIcon className="w-12 h-12 text-gray-700" />
                  </div>
                  <p className="text-gray-600 text-sm">选择一张图片预览</p>
                </div>
              </div>
            )}
          </div>

          {/* 缩略图列表区域 */}
          <ThumbnailGrid
            ref={thumbnailContainerRef}
            files={files}
            selectedFileId={selectedFileId}
            selectedFileIds={selectedFileIds}
            draggedFileId={draggedFileId}
            dragOverFileId={dragOverFileId}
            isLoadingFiles={isLoadingFiles}
            loadingProgress={loadingProgress}
            onThumbnailClick={onThumbnailClick}
            onRemoveFile={onRemoveFile}
            onToggleSelectAll={onToggleSelectAll}
            onRemoveSelected={onRemoveSelectedFiles}
            onClickAdd={() => fileInputRef.current?.click()}
            onDragStartSort={onDragStartSort}
            onDragOverSort={onDragOverSort}
            onDragLeaveSort={onDragLeaveSort}
            onDropSort={onDropSort}
            onDragEndSort={onDragEndSort}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS}
            multiple
            onChange={(e) => e.target.files && onFilesSelected(e.target.files)}
            className="hidden"
          />
        </div>

        {/* ===== 右侧：元数据编辑 ===== */}
        <div className="w-[42%] flex flex-col overflow-hidden">
          <MetadataEditor
            selectedFile={selectedFile}
            filesCount={files.length}
            selectedFileIds={selectedFileIds}
            selectedFileId={selectedFileId}
            filteredStyles={filteredStyles}
            showStyleSuggestions={showStyleSuggestions}
            onUpdateMetadata={onUpdateMetadata}
            onSourceChange={onSourceChange}
            onCopyMetadata={onCopyMetadata}
            onShowStyleSuggestions={onShowStyleSuggestions}
          />
        </div>
      </div>

      {/* 弹窗底部 */}
      <div className="relative px-8 py-5 border-t border-white/[0.08] flex items-center justify-between bg-black/20">
        <p className="text-sm text-gray-500">
          {files.length} 张图片待上传
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-all duration-200 border border-white/[0.08]"
          >
            取消
          </button>
          <button
            onClick={onUpload}
            disabled={files.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-orange-500/20 disabled:shadow-none"
          >
            <Upload className="w-4 h-4" />
            开始上传
          </button>
        </div>
      </div>
    </div>
  );
}
