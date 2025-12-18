'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

interface GlobalDropZoneProps {
  isUploadModalOpen: boolean;
  hasImageModal: boolean;
  onFilesDropped: (files: File[]) => void;
}

export function GlobalDropZone({
  isUploadModalOpen,
  hasImageModal,
  onFilesDropped,
}: GlobalDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // 检测是否包含图像文件
  const hasImageFiles = useCallback((dataTransfer: DataTransfer | null): boolean => {
    if (!dataTransfer) return false;
    if (!dataTransfer.types.includes('Files')) return false;

    // 尝试检查 items（部分浏览器支持）
    if (dataTransfer.items) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const item = dataTransfer.items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          return true;
        }
      }
      // 如果有 items 但没有图像，返回 false
      if (dataTransfer.items.length > 0) {
        return false;
      }
    }

    // 保守判断：如果无法确定，假设可能有图像
    return true;
  }, []);

  useEffect(() => {
    // 如果有弹窗打开，禁用全局拖放
    if (isUploadModalOpen || hasImageModal) {
      setIsDragging(false);
      dragCounterRef.current = 0;
      return;
    }

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;

      if (dragCounterRef.current === 1 && hasImageFiles(e.dataTransfer)) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;

      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      // 过滤图像文件
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));

      if (imageFiles.length === 0) {
        toast.warning('请拖放图片文件');
        return;
      }

      if (imageFiles.length < files.length) {
        toast.info(`已忽略 ${files.length - imageFiles.length} 个非图片文件`);
      }

      onFilesDropped(imageFiles);
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [isUploadModalOpen, hasImageModal, hasImageFiles, onFilesDropped]);

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          {/* 毛玻璃背景 */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" />

          {/* 中央内容 */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative flex flex-col items-center gap-6"
          >
            {/* 大图标 */}
            <div className="p-8 bg-orange-500/10 rounded-3xl border-2 border-dashed border-orange-500/40">
              <Upload className="w-16 h-16 text-orange-400" />
            </div>

            {/* 文字提示 */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">拖放图片以上传</h2>
              <p className="text-gray-400">松开鼠标即可开始上传</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
