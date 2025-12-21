'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UploadTask } from '../hooks/useUploadQueue';
import { useUploadModal } from '../hooks/useUploadModal';
import {
  CloseConfirmDialog,
  UploadDropZone,
  UploadEditView,
} from './upload';

const ALLOWED_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartUpload: (tasks: UploadTask[]) => void;
  initialFiles?: File[] | null;
  onFilesConsumed?: () => void;
}

export function UploadModal({ isOpen, onClose, onStartUpload, initialFiles, onFilesConsumed }: UploadModalProps) {
  const modal = useUploadModal({ onClose, onStartUpload });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ESC 键关闭 + 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // ESC 键处理
      if (e.key === 'Escape') {
        if (modal.showCloseConfirm) {
          modal.setShowCloseConfirm(false);
        } else {
          modal.tryClose();
        }
        return;
      }

      // 以下快捷键仅在编辑阶段生效
      if (modal.phase !== 'edit') return;

      // 检查是否在输入框中
      const activeElement = document.activeElement;
      const isInInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      // Ctrl/Cmd + A 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isInInput) {
        e.preventDefault();
        modal.toggleSelectAll();
        return;
      }

      // Delete/Backspace 删除
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInInput) {
        e.preventDefault();
        modal.removeSelectedFiles();
        return;
      }

      // 方向键导航
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && !isInInput) {
        e.preventDefault();
        const currentIndex = modal.files.findIndex((f) => f.id === modal.selectedFileId);
        if (currentIndex === -1 && modal.files.length > 0) {
          modal.setSelectedFileId(modal.files[0].id);
          modal.setLastClickedId(modal.files[0].id);
          return;
        }

        const cols = 8;
        let newIndex = currentIndex;

        switch (e.key) {
          case 'ArrowLeft':
            newIndex = Math.max(0, currentIndex - 1);
            break;
          case 'ArrowRight':
            newIndex = Math.min(modal.files.length - 1, currentIndex + 1);
            break;
          case 'ArrowUp':
            newIndex = Math.max(0, currentIndex - cols);
            break;
          case 'ArrowDown':
            newIndex = Math.min(modal.files.length - 1, currentIndex + cols);
            break;
        }

        if (newIndex !== currentIndex && modal.files[newIndex]) {
          modal.setSelectedFileId(modal.files[newIndex].id);
          modal.setLastClickedId(modal.files[newIndex].id);
          modal.setSelectedFileIds(new Set());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, modal]);

  // 处理从全局拖放传入的初始文件
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0 && isOpen) {
      modal.handleFilesSelected(initialFiles);
      onFilesConsumed?.();
    }
  }, [initialFiles, isOpen, modal.handleFilesSelected, onFilesConsumed]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 遮罩层 - 毛玻璃效果 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={modal.tryClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          />

          {/* 弹窗主体 - 带 layout 动画 */}
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              layout: { type: 'spring', damping: 25, stiffness: 200 },
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 }
            }}
            className={`relative bg-[#0d0d0d]/80 backdrop-blur-2xl rounded-3xl
              border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)]
              overflow-hidden flex flex-col ${
              modal.phase === 'select'
                ? 'w-[420px]'
                : 'w-full max-w-[1400px] h-[92vh] max-h-[1050px]'
            }`}
          >
            {/* 顶部橙色光晕装饰 */}
            <motion.div
              layout
              className={`absolute top-0 left-1/2 -translate-x-1/2 rounded-full blur-[80px] pointer-events-none ${
                modal.phase === 'select'
                  ? 'w-[250px] h-[120px] bg-orange-500/20'
                  : 'w-[600px] h-[200px] bg-orange-500/12'
              }`}
            />

            <AnimatePresence mode="wait">
              {modal.phase === 'select' ? (
                /* ===== 阶段1：小型选择弹窗 ===== */
                <motion.div
                  key="select-phase"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <UploadDropZone
                    isDragOver={modal.isDragOver}
                    onDragOver={modal.handleDragOver}
                    onDragLeave={modal.handleDragLeave}
                    onDrop={modal.handleDrop}
                    onClickSelect={() => fileInputRef.current?.click()}
                    onClose={modal.tryClose}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_EXTENSIONS}
                    multiple
                    onChange={(e) => e.target.files && modal.handleFilesSelected(e.target.files)}
                    className="hidden"
                  />
                </motion.div>
              ) : (
                /* ===== 阶段2：完整编辑界面 ===== */
                <motion.div
                  key="edit-phase"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="relative flex flex-col h-full"
                >
                  <UploadEditView
                    files={modal.files}
                    selectedFile={modal.selectedFile}
                    selectedFileId={modal.selectedFileId}
                    selectedFileIds={modal.selectedFileIds}
                    isDragOver={modal.isDragOver}
                    isLoadingFiles={modal.isLoadingFiles}
                    loadingProgress={modal.loadingProgress}
                    showStyleSuggestions={modal.showStyleSuggestions}
                    filteredStyles={modal.filteredStyles}
                    draggedFileId={modal.draggedFileId}
                    dragOverFileId={modal.dragOverFileId}
                    onRemoveFile={modal.removeFile}
                    onRemoveSelectedFiles={modal.removeSelectedFiles}
                    onThumbnailClick={modal.handleThumbnailClick}
                    onToggleSelectAll={modal.toggleSelectAll}
                    onDragStartSort={modal.handleDragStartSort}
                    onDragOverSort={modal.handleDragOverSort}
                    onDragLeaveSort={modal.handleDragLeaveSort}
                    onDropSort={modal.handleDropSort}
                    onDragEndSort={modal.handleDragEndSort}
                    onDragOver={modal.handleDragOver}
                    onDragLeave={modal.handleDragLeave}
                    onDrop={modal.handleDrop}
                    onUpdateMetadata={modal.updateFileMetadata}
                    onSourceChange={modal.handleSourceChange}
                    onCopyMetadata={modal.copyMetadataToSelected}
                    onShowStyleSuggestions={modal.setShowStyleSuggestions}
                    onClose={modal.tryClose}
                    onUpload={modal.handleUpload}
                    onFilesSelected={modal.handleFilesSelected}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 确认关闭弹窗 */}
          <CloseConfirmDialog
            isOpen={modal.showCloseConfirm}
            filesCount={modal.files.length}
            onConfirm={modal.handleClose}
            onCancel={() => modal.setShowCloseConfirm(false)}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
