'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  Box,
  Palette,
  Layers,
  Sparkles,
  FileText,
  Copy,
  GripVertical,
  CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import type { UploadTask } from '../hooks/useUploadQueue';
import { MODEL_BASES, STYLE_SOURCES } from '../lib/constants';
import type { ModelBase, StyleSource } from '../lib/constants';
import { useStyles } from '../hooks/useStyles';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILE_COUNT = 500; // 单次最大文件数量

// 输入校验正则：只允许中文、英文、数字、空格、下划线、中划线、点号
const VALID_INPUT_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9\s_.\-]*$/;

// 校验输入是否合法
const validateInput = (value: string): boolean => {
  return VALID_INPUT_REGEX.test(value);
};

interface FileMetadata {
  title: string;
  prompt: string;
  model_base: ModelBase | '';
  source: StyleSource | '';
  style: string;
  imported_at: string;
}

interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
  metadata: FileMetadata;
  isLoading?: boolean; // 图片是否正在加载
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartUpload: (tasks: UploadTask[]) => void;
  initialFiles?: File[] | null;
  onFilesConsumed?: () => void;
}

export function UploadModal({ isOpen, onClose, onStartUpload, initialFiles, onFilesConsumed }: UploadModalProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set()); // 多选状态
  const [lastClickedId, setLastClickedId] = useState<string | null>(null); // 用于 Shift 范围选择
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null); // 拖拽排序状态
  const [dragOverFileId, setDragOverFileId] = useState<string | null>(null); // 拖拽悬停目标
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  // 批量应用状态
  const [batchModelBase, setBatchModelBase] = useState<ModelBase | ''>('');
  const [batchSource, setBatchSource] = useState<StyleSource | ''>('');
  const [batchStyle, setBatchStyle] = useState('');
  const [batchImportedAt, setBatchImportedAt] = useState('');

  // 风格输入预测状态
  const [showStyleSuggestions, setShowStyleSuggestions] = useState(false);
  const [showBatchStyleSuggestions, setShowBatchStyleSuggestions] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [deletedFiles, setDeletedFiles] = useState<FileWithPreview[]>([]); // 删除回收站（用于撤销）
  const [isLoadingFiles, setIsLoadingFiles] = useState(false); // 文件加载状态
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 }); // 加载进度
  const { availableStyles } = useStyles();

  // 根据文件数量自动判断阶段
  const phase = files.length === 0 ? 'select' : 'edit';

  const selectedFile = files.find((f) => f.id === selectedFileId);

  // 根据当前 source 和输入过滤风格建议
  const filteredStyles = useMemo(() => {
    const source = selectedFile?.metadata.source;
    const styleInput = selectedFile?.metadata.style || '';
    if (!source) return [];
    const sourceStyles = availableStyles[source] || [];
    if (!styleInput) return sourceStyles.slice(0, 8);
    return sourceStyles
      .filter((s) => s.toLowerCase().includes(styleInput.toLowerCase()))
      .slice(0, 8);
  }, [availableStyles, selectedFile?.metadata.source, selectedFile?.metadata.style]);

  // 批量风格建议过滤
  const filteredBatchStyles = useMemo(() => {
    if (!batchSource) return [];
    const sourceStyles = availableStyles[batchSource] || [];
    if (!batchStyle) return sourceStyles;
    return sourceStyles.filter((s) => s.toLowerCase().includes(batchStyle.toLowerCase()));
  }, [availableStyles, batchSource, batchStyle]);

  // ===== 批量选择功能 =====
  // 处理缩略图点击（支持 Ctrl 多选和 Shift 范围选择）
  const handleThumbnailClick = useCallback(
    (fileId: string, e: React.MouseEvent) => {
      const isCtrlPressed = e.ctrlKey || e.metaKey;
      const isShiftPressed = e.shiftKey;

      if (isCtrlPressed) {
        // Ctrl + 点击：切换选中状态
        setSelectedFileIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(fileId)) {
            newSet.delete(fileId);
          } else {
            newSet.add(fileId);
          }
          return newSet;
        });
        setLastClickedId(fileId);
      } else if (isShiftPressed && lastClickedId) {
        // Shift + 点击：范围选择
        const lastIndex = files.findIndex((f) => f.id === lastClickedId);
        const currentIndex = files.findIndex((f) => f.id === fileId);
        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          const rangeIds = files.slice(start, end + 1).map((f) => f.id);
          setSelectedFileIds((prev) => {
            const newSet = new Set(prev);
            rangeIds.forEach((id) => newSet.add(id));
            return newSet;
          });
        }
      } else {
        // 普通点击：单选
        setSelectedFileIds(new Set());
        setSelectedFileId(fileId);
        setLastClickedId(fileId);
      }
    },
    [files, lastClickedId]
  );

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedFileIds.size === files.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(files.map((f) => f.id)));
    }
  }, [files, selectedFileIds.size]);

  // 删除选中的文件（支持多选删除和撤销）
  const removeSelectedFiles = useCallback(() => {
    const idsToRemove = selectedFileIds.size > 0 ? selectedFileIds : (selectedFileId ? new Set([selectedFileId]) : new Set());
    if (idsToRemove.size === 0) return;

    // 暂存到回收站
    const filesToRemove = files.filter((f) => idsToRemove.has(f.id));
    setDeletedFiles((prev) => [...prev, ...filesToRemove]);

    // 从列表移除（不释放 preview URL）
    setFiles((prev) => prev.filter((f) => !idsToRemove.has(f.id)));

    // 清理选中状态
    setSelectedFileIds(new Set());
    if (selectedFileId && idsToRemove.has(selectedFileId)) {
      const remaining = files.filter((f) => !idsToRemove.has(f.id));
      setSelectedFileId(remaining.length > 0 ? remaining[0].id : null);
    }

    const count = idsToRemove.size;
    const removedIds = Array.from(idsToRemove);

    // 显示带撤销按钮的 toast
    toast(`已删除 ${count} 张图片`, {
      action: {
        label: '撤销',
        onClick: () => {
          // 恢复文件
          setFiles((prev) => [...prev, ...filesToRemove]);
          setDeletedFiles((prev) => prev.filter((f) => !removedIds.includes(f.id)));
          if (filesToRemove.length > 0) {
            setSelectedFileId(filesToRemove[0].id);
          }
          toast.success(`已恢复 ${count} 张图片`);
        },
      },
      duration: 3000,
      onDismiss: () => {
        // toast 消失后真正释放资源
        setDeletedFiles((prev) => {
          prev.filter((f) => removedIds.includes(f.id)).forEach((f) => {
            URL.revokeObjectURL(f.preview);
          });
          return prev.filter((f) => !removedIds.includes(f.id));
        });
      },
    });
  }, [selectedFileIds, selectedFileId, files]);

  // ===== 元数据复制功能 =====
  const copyMetadataToSelected = useCallback(() => {
    if (!selectedFile) {
      toast.error('请先选择一张图片');
      return;
    }

    const targetIds = selectedFileIds.size > 0
      ? Array.from(selectedFileIds).filter((id) => id !== selectedFileId)
      : files.filter((f) => f.id !== selectedFileId).map((f) => f.id);

    if (targetIds.length === 0) {
      toast.error('没有其他图片可应用');
      return;
    }

    const metadataToCopy = {
      model_base: selectedFile.metadata.model_base,
      source: selectedFile.metadata.source,
      style: selectedFile.metadata.style,
      imported_at: selectedFile.metadata.imported_at,
    };

    setFiles((prev) =>
      prev.map((f) =>
        targetIds.includes(f.id)
          ? { ...f, metadata: { ...f.metadata, ...metadataToCopy } }
          : f
      )
    );

    toast.success(`已将设置复制到 ${targetIds.length} 张图片`);
    setSelectedFileIds(new Set());
  }, [selectedFile, selectedFileId, selectedFileIds, files]);

  // ===== 拖拽排序功能 =====
  const handleDragStartSort = useCallback((e: React.DragEvent, fileId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', fileId);
    setDraggedFileId(fileId);
  }, []);

  const handleDragOverSort = useCallback((e: React.DragEvent, fileId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedFileId && draggedFileId !== fileId) {
      setDragOverFileId(fileId);
    }
  }, [draggedFileId]);

  const handleDragLeaveSort = useCallback(() => {
    setDragOverFileId(null);
  }, []);

  const handleDropSort = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedFileId || draggedFileId === targetId) {
        setDraggedFileId(null);
        setDragOverFileId(null);
        return;
      }

      setFiles((prev) => {
        const newFiles = [...prev];
        const draggedIndex = newFiles.findIndex((f) => f.id === draggedFileId);
        const targetIndex = newFiles.findIndex((f) => f.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return prev;

        const [draggedFile] = newFiles.splice(draggedIndex, 1);
        newFiles.splice(targetIndex, 0, draggedFile);

        return newFiles;
      });

      setDraggedFileId(null);
      setDragOverFileId(null);
    },
    [draggedFileId]
  );

  const handleDragEndSort = useCallback(() => {
    setDraggedFileId(null);
    setDragOverFileId(null);
  }, []);

  // 处理文件选择（支持大量图片异步加载）
  const handleFilesSelected = useCallback(
    async (selectedFiles: FileList | File[]) => {
      const fileArray = Array.from(selectedFiles).filter((f) => f.type.startsWith('image/'));
      if (fileArray.length === 0) return;

      const oversizedFiles: string[] = [];
      const currentCount = files.length;
      let skippedDueToLimit = 0;

      // 过滤有效文件
      const validFiles: File[] = [];
      for (const file of fileArray) {
        if (currentCount + validFiles.length >= MAX_FILE_COUNT) {
          skippedDueToLimit++;
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          oversizedFiles.push(file.name);
          continue;
        }
        validFiles.push(file);
      }

      if (skippedDueToLimit > 0) {
        toast.error(`单次最多上传 ${MAX_FILE_COUNT} 张图片，已跳过 ${skippedDueToLimit} 张`);
      }

      if (oversizedFiles.length > 0) {
        const displayNames = oversizedFiles.slice(0, 3).join(', ');
        const more = oversizedFiles.length > 3 ? ` 等 ${oversizedFiles.length} 个文件` : '';
        toast.error(`超过 20MB 限制: ${displayNames}${more}`);
      }

      if (validFiles.length === 0) return;

      // 大于 10 张图片时显示加载状态
      const showProgress = validFiles.length > 10;
      if (showProgress) {
        setIsLoadingFiles(true);
        setLoadingProgress({ current: 0, total: validFiles.length });
      }

      const newFiles: FileWithPreview[] = [];
      const batchSize = 5; // 每批处理 5 个

      for (let i = 0; i < validFiles.length; i += batchSize) {
        const batch = validFiles.slice(i, Math.min(i + batchSize, validFiles.length));

        for (let j = 0; j < batch.length; j++) {
          const file = batch[j];
          const globalIndex = i + j;
          newFiles.push({
            file,
            preview: URL.createObjectURL(file),
            id: `${Date.now()}-${globalIndex}-${Math.random().toString(36).substr(2, 9)}`,
            metadata: {
              title: file.name.replace(/\.[^/.]+$/, ''),
              prompt: '',
              model_base: '',
              source: '',
              style: '',
              imported_at: '',
            },
          });
        }

        if (showProgress) {
          setLoadingProgress({ current: Math.min(i + batchSize, validFiles.length), total: validFiles.length });
          // 让 UI 有机会更新
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }

      setFiles((prev) => [...prev, ...newFiles]);
      if (!selectedFileId && newFiles.length > 0) {
        setSelectedFileId(newFiles[0].id);
      }

      if (showProgress) {
        setIsLoadingFiles(false);
        setLoadingProgress({ current: 0, total: 0 });
      }
    },
    [files.length, selectedFileId]
  );

  // 拖拽处理（文件上传）
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // 如果正在进行缩略图排序，不触发上传高亮
    if (draggedFileId) return;
    setIsDragOver(true);
  }, [draggedFileId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // 如果正在进行缩略图排序，不处理
    if (draggedFileId) return;
    setIsDragOver(false);
  }, [draggedFileId]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      // 如果正在进行缩略图排序，不处理文件上传
      if (draggedFileId) return;
      handleFilesSelected(e.dataTransfer.files);
    },
    [handleFilesSelected, draggedFileId]
  );

  // 删除文件（支持撤销）
  const removeFile = useCallback(
    (id: string) => {
      const fileToRemove = files.find((f) => f.id === id);
      if (!fileToRemove) return;

      // 暂存到回收站（不释放 preview URL）
      setDeletedFiles((prev) => [...prev, fileToRemove]);

      // 从列表移除
      setFiles((prev) => prev.filter((f) => f.id !== id));

      // 更新选中状态
      if (selectedFileId === id) {
        const remaining = files.filter((f) => f.id !== id);
        setSelectedFileId(remaining.length > 0 ? remaining[0].id : null);
      }

      // 显示带撤销按钮的 toast
      toast('已删除图片', {
        description: fileToRemove.metadata.title,
        action: {
          label: '撤销',
          onClick: () => {
            // 恢复文件
            setFiles((prev) => [...prev, fileToRemove]);
            setDeletedFiles((prev) => prev.filter((f) => f.id !== id));
            setSelectedFileId(fileToRemove.id);
            toast.success('已恢复图片');
          },
        },
        duration: 3000,
        onDismiss: () => {
          // toast 消失后真正释放资源
          setDeletedFiles((prev) => {
            const file = prev.find((f) => f.id === id);
            if (file) URL.revokeObjectURL(file.preview);
            return prev.filter((f) => f.id !== id);
          });
        },
      });
    },
    [selectedFileId, files]
  );

  // 更新文件元数据
  const updateFileMetadata = useCallback(
    (id: string, updates: Partial<FileMetadata>) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, metadata: { ...f.metadata, ...updates } } : f
        )
      );
    },
    []
  );

  // 处理风格大类变更（联动清空不匹配的具体风格）
  const handleSourceChange = useCallback(
    (fileId: string, newSource: StyleSource) => {
      let didClearStyle = false;
      setFiles((prev) =>
        prev.map((f) => {
          if (f.id !== fileId) return f;
          const currentStyle = f.metadata.style;
          const newSourceStyles = availableStyles[newSource] || [];
          // 如果当前风格不在新分类中，清空
          const shouldClearStyle = currentStyle && !newSourceStyles.includes(currentStyle);
          if (shouldClearStyle) didClearStyle = true;
          return {
            ...f,
            metadata: {
              ...f.metadata,
              source: newSource,
              ...(shouldClearStyle ? { style: '' } : {}),
            },
          };
        })
      );
      if (didClearStyle) {
        toast.info('已清空不匹配的具体风格');
      }
    },
    [availableStyles]
  );

  // 批量应用
  const applyBatch = useCallback(() => {
    if (!batchModelBase && !batchSource && !batchStyle && !batchImportedAt) {
      toast.error('请至少填写一项批量应用内容');
      return;
    }

    // 校验输入
    if (batchStyle && !validateInput(batchStyle)) {
      toast.error('风格只允许中文、英文、数字、空格、下划线、中划线、点号');
      return;
    }
    if (batchImportedAt && !validateInput(batchImportedAt)) {
      toast.error('风格参照只允许中文、英文、数字、空格、下划线、中划线、点号');
      return;
    }

    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        metadata: {
          ...f.metadata,
          ...(batchModelBase ? { model_base: batchModelBase } : {}),
          ...(batchSource ? { source: batchSource } : {}),
          ...(batchStyle ? { style: batchStyle } : {}),
          ...(batchImportedAt ? { imported_at: batchImportedAt } : {}),
        },
      }))
    );
    toast.success('已批量应用设置');
  }, [batchModelBase, batchSource, batchStyle, batchImportedAt]);

  // 开始上传（传递任务到全局队列）
  const handleUpload = useCallback(() => {
    if (files.length === 0) return;

    // 校验所有文件的必填字段和输入合法性
    const invalidFiles: string[] = [];
    const missingRequired: string[] = [];

    for (const f of files) {
      // 检查必填字段
      if (!f.metadata.model_base || !f.metadata.source) {
        missingRequired.push(f.metadata.title);
      }
      // 检查输入合法性
      if (f.metadata.style && !validateInput(f.metadata.style)) {
        invalidFiles.push(`${f.metadata.title} (风格)`);
      }
      if (f.metadata.imported_at && !validateInput(f.metadata.imported_at)) {
        invalidFiles.push(`${f.metadata.title} (风格参照)`);
      }
    }

    if (missingRequired.length > 0) {
      const displayNames = missingRequired.slice(0, 3).join(', ');
      const more = missingRequired.length > 3 ? ` 等 ${missingRequired.length} 个文件` : '';
      toast.error(`请填写必填字段（模型基底、风格大类）: ${displayNames}${more}`);
      return;
    }

    if (invalidFiles.length > 0) {
      const displayNames = invalidFiles.slice(0, 3).join(', ');
      const more = invalidFiles.length > 3 ? ` 等 ${invalidFiles.length} 个问题` : '';
      toast.error(`输入包含非法字符（仅允许中文、英文、数字、空格、下划线、中划线、点号）: ${displayNames}${more}`);
      return;
    }

    // 构建任务列表，字段映射到 API 字段名
    const tasks: UploadTask[] = files.map((f) => ({
      id: f.id,
      file: f.file,
      metadata: {
        title: f.metadata.title,
        prompt: f.metadata.prompt,
        model_base: f.metadata.model_base,
        source: f.metadata.source,
        style: f.metadata.style,
        imported_at: f.metadata.imported_at,
      },
      status: 'pending' as const,
    }));

    // 清理预览 URL
    files.forEach((f) => URL.revokeObjectURL(f.preview));

    // 重置状态
    setFiles([]);
    setSelectedFileId(null);
    setBatchModelBase('');
    setBatchSource('');
    setBatchStyle('');
    setBatchImportedAt('');

    // 传递任务并关闭弹窗
    onStartUpload(tasks);
    onClose();
  }, [files, onStartUpload, onClose]);

  // 关闭时清理
  const handleClose = useCallback(() => {
    // 清理当前文件的 preview URL
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    // 清理回收站中的 preview URL
    deletedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setDeletedFiles([]);
    setSelectedFileId(null);
    setSelectedFileIds(new Set());
    setLastClickedId(null);
    setDraggedFileId(null);
    setDragOverFileId(null);
    setBatchModelBase('');
    setBatchSource('');
    setBatchStyle('');
    setBatchImportedAt('');
    setShowCloseConfirm(false);
    onClose();
  }, [files, deletedFiles, onClose]);

  // 尝试关闭 - 有文件时显示确认弹窗
  const tryClose = useCallback(() => {
    if (files.length > 0) {
      setShowCloseConfirm(true);
    } else {
      handleClose();
    }
  }, [files.length, handleClose]);

  // ESC 键关闭 + 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // ESC 键处理
      if (e.key === 'Escape') {
        if (showCloseConfirm) {
          setShowCloseConfirm(false);
        } else {
          tryClose();
        }
        return;
      }

      // 以下快捷键仅在编辑阶段生效
      if (phase !== 'edit') return;

      // 检查是否在输入框中，如果是则不处理方向键和删除键
      const activeElement = document.activeElement;
      const isInInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      // Ctrl/Cmd + A 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isInInput) {
        e.preventDefault();
        toggleSelectAll();
        return;
      }

      // Delete/Backspace 删除
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInInput) {
        e.preventDefault();
        removeSelectedFiles();
        return;
      }

      // 方向键导航
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && !isInInput) {
        e.preventDefault();
        const currentIndex = files.findIndex((f) => f.id === selectedFileId);
        if (currentIndex === -1 && files.length > 0) {
          setSelectedFileId(files[0].id);
          setLastClickedId(files[0].id);
          return;
        }

        const cols = 6; // 网格列数
        let newIndex = currentIndex;

        switch (e.key) {
          case 'ArrowLeft':
            newIndex = Math.max(0, currentIndex - 1);
            break;
          case 'ArrowRight':
            newIndex = Math.min(files.length - 1, currentIndex + 1);
            break;
          case 'ArrowUp':
            newIndex = Math.max(0, currentIndex - cols);
            break;
          case 'ArrowDown':
            newIndex = Math.min(files.length - 1, currentIndex + cols);
            break;
        }

        if (newIndex !== currentIndex && files[newIndex]) {
          setSelectedFileId(files[newIndex].id);
          setLastClickedId(files[newIndex].id);
          setSelectedFileIds(new Set()); // 清除多选
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tryClose, showCloseConfirm, phase, files, selectedFileId, toggleSelectAll, removeSelectedFiles]);

  // 处理从全局拖放传入的初始文件
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0 && isOpen) {
      handleFilesSelected(initialFiles);
      onFilesConsumed?.();
    }
  }, [initialFiles, isOpen, handleFilesSelected, onFilesConsumed]);

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
            onClick={tryClose}
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
              phase === 'select'
                ? 'w-[420px]'
                : 'w-full max-w-[1400px] h-[92vh] max-h-[1050px]'
            }`}
          >
            {/* 顶部橙色光晕装饰 */}
            <motion.div
              layout
              className={`absolute top-0 left-1/2 -translate-x-1/2 rounded-full blur-[80px] pointer-events-none ${
                phase === 'select'
                  ? 'w-[250px] h-[120px] bg-orange-500/20'
                  : 'w-[600px] h-[200px] bg-orange-500/12'
              }`}
            />

            <AnimatePresence mode="wait">
              {phase === 'select' ? (
                /* ===== 阶段1：小型选择弹窗 ===== */
                <motion.div
                  key="select-phase"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="relative p-8"
                >
                  {/* 标题栏 */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20">
                        <Upload className="w-5 h-5 text-orange-400" />
                      </div>
                      <h2 className="text-lg font-semibold text-white tracking-tight">
                        上传图片
                      </h2>
                    </div>
                    <button
                      onClick={tryClose}
                      className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* 拖拽上传区 */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`aspect-[4/3] border-2 border-dashed rounded-2xl
                      flex flex-col items-center justify-center cursor-pointer
                      transition-all duration-300 ${
                      isDragOver
                        ? 'border-orange-500/60 bg-orange-500/10 scale-[0.98]'
                        : 'border-white/15 hover:border-white/25 hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className={`p-4 rounded-2xl mb-4 transition-all duration-300 ${
                      isDragOver ? 'bg-orange-500/20' : 'bg-white/[0.05]'
                    }`}>
                      <Upload className={`w-8 h-8 transition-colors duration-300 ${
                        isDragOver ? 'text-orange-400' : 'text-gray-500'
                      }`} />
                    </div>
                    <p className={`text-sm font-medium mb-1 transition-colors duration-300 ${
                      isDragOver ? 'text-orange-300' : 'text-gray-300'
                    }`}>
                      拖拽图片到这里
                    </p>
                    <p className="text-gray-500 text-xs">或点击选择文件</p>
                    <p className="text-gray-600 text-xs mt-4">
                      单个最大 20MB · 单次最多 {MAX_FILE_COUNT} 张
                    </p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
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
                      onClick={tryClose}
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
                      className={`w-1/2 flex flex-col border-r border-white/[0.08] transition-all duration-300 ${
                        isDragOver ? 'bg-orange-500/5 ring-2 ring-inset ring-orange-500/30' : ''
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {/* 大预览图区域 - 减少留白 */}
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

                      {/* 缩略图列表区域 - 网格布局，3行，上下滚动 */}
                      <div
                        ref={thumbnailContainerRef}
                        className="h-[360px] border-t border-white/[0.08] p-3 bg-black/20 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                      >
                        {/* 操作栏 */}
                        <div className="flex items-center justify-between mb-2 px-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={toggleSelectAll}
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
                                  onClick={removeSelectedFiles}
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

                        <div className="grid grid-cols-6 gap-2">
                          {/* 上传按钮 - 常驻第一位 */}
                          <div
                            onClick={() => fileInputRef.current?.click()}
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
                                onClick={(e) => handleThumbnailClick(f.id, e)}
                                draggable
                                onDragStart={(e) => handleDragStartSort(e, f.id)}
                                onDragOver={(e) => handleDragOverSort(e, f.id)}
                                onDragLeave={handleDragLeaveSort}
                                onDrop={(e) => handleDropSort(e, f.id)}
                                onDragEnd={handleDragEndSort}
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
                                    removeFile(f.id);
                                  }}
                                  className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-red-500/90 text-white/70 hover:text-white rounded-md transition-all duration-200 opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
                        className="hidden"
                      />
                    </div>

                    {/* ===== 右侧：元数据编辑 ===== */}
                    <div className="w-1/2 flex flex-col overflow-hidden">
                      {selectedFile ? (
                        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                          {/* 复制元数据按钮 */}
                          {files.length > 1 && (
                            <button
                              onClick={copyMetadataToSelected}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-300 border border-blue-500/20 hover:from-blue-500/20 hover:to-purple-500/20 hover:border-blue-500/30"
                            >
                              <Copy className="w-4 h-4" />
                              {selectedFileIds.size > 0
                                ? `复制设置到已选的 ${selectedFileIds.size - (selectedFileIds.has(selectedFileId!) ? 1 : 0)} 张图片`
                                : `复制设置到其他 ${files.length - 1} 张图片`}
                            </button>
                          )}

                          {/* 标题 */}
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                              <FileText className="w-3.5 h-3.5 text-gray-500" />
                              标题
                            </label>
                            <input
                              type="text"
                              value={selectedFile.metadata.title}
                              onChange={(e) =>
                                updateFileMetadata(selectedFile.id, { title: e.target.value })
                              }
                              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 focus:bg-white/[0.05] focus:outline-none transition-all duration-200"
                              placeholder="输入标题..."
                            />
                          </div>

                          {/* 模型基底 - 点选按钮 */}
                          <div className="space-y-3">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                              <Box className="w-3.5 h-3.5 text-cyan-500" />
                              模型基底 <span className="text-orange-400">*</span>
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                              {MODEL_BASES.map((base) => (
                                <button
                                  key={base}
                                  type="button"
                                  onClick={() =>
                                    updateFileMetadata(selectedFile.id, { model_base: base })
                                  }
                                  className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                                    selectedFile.metadata.model_base === base
                                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                                      : 'bg-white/[0.03] text-gray-400 border border-white/[0.08] hover:bg-white/[0.06] hover:text-white'
                                  }`}
                                >
                                  {base}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 风格大类 - 点选按钮 */}
                          <div className="space-y-3">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                              <Palette className="w-3.5 h-3.5 text-indigo-500" />
                              风格大类 <span className="text-orange-400">*</span>
                            </label>
                            <div className="flex gap-2">
                              {STYLE_SOURCES.map((src) => (
                                <button
                                  key={src}
                                  type="button"
                                  onClick={() =>
                                    handleSourceChange(selectedFile.id, src)
                                  }
                                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                                    selectedFile.metadata.source === src
                                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                                      : 'bg-white/[0.03] text-gray-400 border border-white/[0.08] hover:bg-white/[0.06] hover:text-white'
                                  }`}
                                >
                                  {src}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 具体风格 - 带输入预测 */}
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                              <Layers className="w-3.5 h-3.5 text-purple-500" />
                              具体风格
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={selectedFile.metadata.style}
                                onChange={(e) => {
                                  updateFileMetadata(selectedFile.id, { style: e.target.value });
                                  setShowStyleSuggestions(true);
                                }}
                                onFocus={() => setShowStyleSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowStyleSuggestions(false), 200)}
                                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-purple-500/50 focus:bg-white/[0.05] focus:outline-none transition-all duration-200"
                                placeholder={selectedFile.metadata.source ? "输入或选择风格..." : "请先选择风格大类"}
                                disabled={!selectedFile.metadata.source}
                              />
                              {/* 下拉建议 */}
                              {showStyleSuggestions && filteredStyles.length > 0 && selectedFile.metadata.source && (
                                <div className="absolute z-20 w-full mt-1 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl overflow-hidden">
                                  <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                    {filteredStyles.map((style) => (
                                      <button
                                        key={style}
                                        type="button"
                                        onMouseDown={() => {
                                          updateFileMetadata(selectedFile.id, { style });
                                          setShowStyleSuggestions(false);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
                                      >
                                        {style}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 风格参照 */}
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                              风格参照 (Style Ref/LoRA)
                            </label>
                            <input
                              type="text"
                              value={selectedFile.metadata.imported_at}
                              onChange={(e) =>
                                updateFileMetadata(selectedFile.id, { imported_at: e.target.value })
                              }
                              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-yellow-500/50 focus:bg-white/[0.05] focus:outline-none transition-all duration-200"
                              placeholder="输入风格代码或 LoRA 名称..."
                            />
                          </div>

                          {/* 提示词 */}
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                              <FileText className="w-3.5 h-3.5 text-gray-500" />
                              提示词
                            </label>
                            <textarea
                              value={selectedFile.metadata.prompt}
                              onChange={(e) =>
                                updateFileMetadata(selectedFile.id, { prompt: e.target.value })
                              }
                              className="w-full h-28 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 focus:bg-white/[0.05] focus:outline-none resize-none transition-all duration-200 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                              placeholder="输入生成提示词..."
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-center">
                            <div className="p-5 bg-white/[0.02] rounded-2xl mx-auto w-fit mb-4">
                              <ImageIcon className="w-12 h-12 text-gray-700" />
                            </div>
                            <p className="text-gray-600 text-sm">选择一张图片编辑元数据</p>
                          </div>
                        </div>
                      )}

                      {/* 批量操作区 */}
                      {files.length > 1 && (
                        <div className="p-5 border-t border-white/[0.08] bg-black/20">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
                            批量应用到所有图片
                          </p>
                          <div className="space-y-3">
                            {/* 模型基底批量 - 点选 */}
                            <div className="grid grid-cols-4 gap-1.5">
                              {MODEL_BASES.map((base) => (
                                <button
                                  key={base}
                                  type="button"
                                  onClick={() => setBatchModelBase(base)}
                                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 ${
                                    batchModelBase === base
                                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                      : 'bg-white/[0.03] text-gray-500 border border-white/[0.06] hover:bg-white/[0.06] hover:text-gray-300'
                                  }`}
                                >
                                  {base}
                                </button>
                              ))}
                            </div>
                            {/* 风格大类批量 */}
                            <div className="flex gap-2">
                              {STYLE_SOURCES.map((src) => (
                                <button
                                  key={src}
                                  type="button"
                                  onClick={() => setBatchSource(src)}
                                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                                    batchSource === src
                                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                      : 'bg-white/[0.03] text-gray-500 border border-white/[0.06] hover:bg-white/[0.06] hover:text-gray-300'
                                  }`}
                                >
                                  {src}
                                </button>
                              ))}
                            </div>
                            {/* 其他批量字段 */}
                            <div className="flex gap-2">
                              {/* 具体风格 - 带输入预测 */}
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  value={batchStyle}
                                  onChange={(e) => {
                                    setBatchStyle(e.target.value);
                                    setShowBatchStyleSuggestions(true);
                                  }}
                                  onFocus={() => setShowBatchStyleSuggestions(true)}
                                  onBlur={() => setTimeout(() => setShowBatchStyleSuggestions(false), 200)}
                                  placeholder={batchSource ? "输入或选择风格..." : "请先选择风格大类"}
                                  disabled={!batchSource}
                                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-purple-500/50 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                {/* 下拉建议 */}
                                {showBatchStyleSuggestions && filteredBatchStyles.length > 0 && batchSource && (
                                  <div className="absolute z-30 w-full bottom-full mb-1 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl overflow-hidden">
                                    <div className="max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                      {filteredBatchStyles.map((style) => (
                                        <button
                                          key={style}
                                          type="button"
                                          onMouseDown={() => {
                                            setBatchStyle(style);
                                            setShowBatchStyleSuggestions(false);
                                          }}
                                          className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
                                        >
                                          {style}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <input
                                type="text"
                                value={batchImportedAt}
                                onChange={(e) => setBatchImportedAt(e.target.value)}
                                placeholder="风格参照"
                                className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-yellow-500/50 focus:outline-none transition-all duration-200"
                              />
                              <button
                                onClick={applyBatch}
                                className="px-4 py-2 bg-white/[0.06] hover:bg-orange-500/20 hover:text-orange-300 text-white rounded-lg text-xs font-medium transition-all duration-200 border border-transparent hover:border-orange-500/30"
                              >
                                应用
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 弹窗底部 */}
                  <div className="relative px-8 py-5 border-t border-white/[0.08] flex items-center justify-between bg-black/20">
                    <p className="text-sm text-gray-500">
                      {files.length} 张图片待上传
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={tryClose}
                        className="px-6 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-all duration-200 border border-white/[0.08]"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleUpload}
                        disabled={files.length === 0}
                        className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-orange-500/20 disabled:shadow-none"
                      >
                        <Upload className="w-4 h-4" />
                        开始上传
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 确认关闭弹窗 */}
          <AnimatePresence>
            {showCloseConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex items-center justify-center"
              >
                {/* 遮罩 */}
                <div
                  className="absolute inset-0 bg-black/40"
                  onClick={() => setShowCloseConfirm(false)}
                />
                {/* 确认框 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="relative bg-[#1a1a1a]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-6 w-[340px]"
                >
                  {/* 警告图标 */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white">确认关闭</h3>
                  </div>

                  <p className="text-sm text-gray-400 mb-6">
                    你有 <span className="text-orange-400 font-medium">{files.length}</span> 张图片尚未上传，关闭后编辑内容将丢失。确定要关闭吗？
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCloseConfirm(false)}
                      className="flex-1 px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-all duration-200 border border-white/[0.08]"
                    >
                      继续编辑
                    </button>
                    <button
                      onClick={handleClose}
                      className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-xl text-sm font-medium transition-all duration-200 border border-red-500/30"
                    >
                      确认关闭
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}
