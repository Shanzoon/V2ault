'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { MODEL_BASES, STYLE_SOURCES } from '../lib/constants';
import type { ModelBase, StyleSource } from '../lib/constants';
import { useStyles } from './useStyles';
import type { UploadTask } from './useUploadQueue';

// ============================================
// 常量
// ============================================

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILE_COUNT = 500;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
const UPLOAD_DEFAULTS_KEY = 'v2ault_upload_defaults';

// ============================================
// 类型定义
// ============================================

export interface FileMetadata {
  title: string;
  prompt: string;
  model_base: ModelBase | '';
  source: StyleSource | '';
  style: string;
  imported_at: string;
}

export interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
  metadata: FileMetadata;
  isLoading?: boolean;
}

interface UploadDefaults {
  model_base: ModelBase;
  source: StyleSource;
}

export interface UseUploadModalProps {
  onClose: () => void;
  onStartUpload: (tasks: UploadTask[]) => void;
  initialFiles?: File[] | null;
}

export interface UseUploadModalReturn {
  // 文件状态
  files: FileWithPreview[];
  selectedFile: FileWithPreview | undefined;
  selectedFileId: string | null;
  selectedFileIds: Set<string>;
  lastClickedId: string | null;

  // UI 状态
  phase: 'select' | 'edit';
  isDragOver: boolean;
  isLoadingFiles: boolean;
  loadingProgress: { current: number; total: number };
  showStyleSuggestions: boolean;
  showCloseConfirm: boolean;
  filteredStyles: string[];

  // 拖拽排序状态
  draggedFileId: string | null;
  dragOverFileId: string | null;

  // 文件操作
  handleFilesSelected: (files: FileList | File[]) => Promise<void>;
  removeFile: (id: string) => void;
  removeSelectedFiles: () => void;

  // 选择操作
  handleThumbnailClick: (fileId: string, e: React.MouseEvent) => void;
  toggleSelectAll: () => void;
  setSelectedFileId: (id: string | null) => void;
  setLastClickedId: (id: string | null) => void;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Set<string>>>;

  // 拖拽排序操作
  handleDragStartSort: (e: React.DragEvent, fileId: string) => void;
  handleDragOverSort: (e: React.DragEvent, fileId: string) => void;
  handleDragLeaveSort: () => void;
  handleDropSort: (e: React.DragEvent, targetId: string) => void;
  handleDragEndSort: () => void;

  // 拖拽上传操作
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;

  // 元数据操作
  updateFileMetadata: (id: string, updates: Partial<FileMetadata>) => void;
  handleSourceChange: (fileId: string, source: StyleSource) => void;
  copyMetadataToSelected: () => void;
  setShowStyleSuggestions: (show: boolean) => void;

  // 弹窗操作
  handleUpload: () => void;
  handleClose: () => void;
  tryClose: () => void;
  setShowCloseConfirm: (show: boolean) => void;

  // Refs
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  thumbnailContainerRef: React.RefObject<HTMLDivElement | null>;
  isComposingRef: React.MutableRefObject<boolean>;
}

// ============================================
// 工具函数
// ============================================

const getUploadDefaults = (): UploadDefaults => {
  if (typeof window === 'undefined') {
    return { model_base: MODEL_BASES[0], source: STYLE_SOURCES[0] };
  }
  try {
    const saved = localStorage.getItem(UPLOAD_DEFAULTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (MODEL_BASES.includes(parsed.model_base) && STYLE_SOURCES.includes(parsed.source)) {
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return { model_base: MODEL_BASES[0], source: STYLE_SOURCES[0] };
};

const saveUploadDefaults = (defaults: UploadDefaults) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UPLOAD_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {
    // ignore storage errors
  }
};

// ============================================
// Hook 实现
// ============================================

export function useUploadModal({
  onClose,
  onStartUpload,
}: UseUploadModalProps): UseUploadModalReturn {
  // ===== 文件状态 =====
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  // ===== UI 状态 =====
  const [isDragOver, setIsDragOver] = useState(false);
  const [showStyleSuggestions, setShowStyleSuggestions] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });

  // ===== 拖拽排序状态 =====
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dragOverFileId, setDragOverFileId] = useState<string | null>(null);

  // ===== Refs =====
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  // ===== 外部 Hook =====
  const { availableStyles } = useStyles();

  // ===== 计算属性 =====
  const phase = files.length === 0 ? 'select' : 'edit';
  const selectedFile = files.find((f) => f.id === selectedFileId);

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

  // ===== 批量选择功能 =====
  const handleThumbnailClick = useCallback(
    (fileId: string, e: React.MouseEvent) => {
      const isCtrlPressed = e.ctrlKey || e.metaKey;
      const isShiftPressed = e.shiftKey;

      if (isCtrlPressed) {
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
        setSelectedFileIds(new Set());
        setSelectedFileId(fileId);
        setLastClickedId(fileId);
      }
    },
    [files, lastClickedId]
  );

  const toggleSelectAll = useCallback(() => {
    if (selectedFileIds.size === files.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(files.map((f) => f.id)));
    }
  }, [files, selectedFileIds.size]);

  const removeSelectedFiles = useCallback(() => {
    const idsToRemove = selectedFileIds.size > 0 ? selectedFileIds : (selectedFileId ? new Set([selectedFileId]) : new Set());
    if (idsToRemove.size === 0) return;

    const filesToRemove = files.filter((f) => idsToRemove.has(f.id));
    filesToRemove.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles((prev) => prev.filter((f) => !idsToRemove.has(f.id)));

    setSelectedFileIds(new Set());
    if (selectedFileId && idsToRemove.has(selectedFileId)) {
      const remaining = files.filter((f) => !idsToRemove.has(f.id));
      setSelectedFileId(remaining.length > 0 ? remaining[0].id : null);
    }

    toast.success(`已删除 ${idsToRemove.size} 张图片`);
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
      prompt: selectedFile.metadata.prompt,
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

  // ===== 文件选择处理 =====
  const handleFilesSelected = useCallback(
    async (selectedFiles: FileList | File[]) => {
      const fileArray = Array.from(selectedFiles);
      if (fileArray.length === 0) return;

      const oversizedFiles: string[] = [];
      const invalidTypeFiles: string[] = [];
      const currentCount = files.length;
      let skippedDueToLimit = 0;

      const validFiles: File[] = [];
      for (const file of fileArray) {
        if (currentCount + validFiles.length >= MAX_FILE_COUNT) {
          skippedDueToLimit++;
          continue;
        }
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          invalidTypeFiles.push(file.name);
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

      if (invalidTypeFiles.length > 0) {
        const displayNames = invalidTypeFiles.slice(0, 3).join(', ');
        const more = invalidTypeFiles.length > 3 ? ` 等 ${invalidTypeFiles.length} 个文件` : '';
        toast.error(`不支持的文件格式（仅支持 JPG/PNG/WebP）: ${displayNames}${more}`);
      }

      if (oversizedFiles.length > 0) {
        const displayNames = oversizedFiles.slice(0, 3).join(', ');
        const more = oversizedFiles.length > 3 ? ` 等 ${oversizedFiles.length} 个文件` : '';
        toast.error(`超过 20MB 限制: ${displayNames}${more}`);
      }

      if (validFiles.length === 0) return;

      const defaults = getUploadDefaults();
      const showProgress = validFiles.length > 10;

      if (showProgress) {
        setIsLoadingFiles(true);
        setLoadingProgress({ current: 0, total: validFiles.length });
      }

      const newFiles: FileWithPreview[] = [];
      const batchSize = 5;

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
              model_base: defaults.model_base,
              source: defaults.source,
              style: '',
              imported_at: '',
            },
          });
        }

        if (showProgress) {
          setLoadingProgress({ current: Math.min(i + batchSize, validFiles.length), total: validFiles.length });
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

  // ===== 拖拽上传处理 =====
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (draggedFileId) return;
    setIsDragOver(true);
  }, [draggedFileId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (draggedFileId) return;
    setIsDragOver(false);
  }, [draggedFileId]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (draggedFileId) return;
      handleFilesSelected(e.dataTransfer.files);
    },
    [handleFilesSelected, draggedFileId]
  );

  // ===== 文件删除 =====
  const removeFile = useCallback(
    (id: string) => {
      const fileToRemove = files.find((f) => f.id === id);
      if (!fileToRemove) return;

      URL.revokeObjectURL(fileToRemove.preview);
      setFiles((prev) => prev.filter((f) => f.id !== id));

      if (selectedFileId === id) {
        const remaining = files.filter((f) => f.id !== id);
        setSelectedFileId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
    [selectedFileId, files]
  );

  // ===== 元数据更新 =====
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

  const handleSourceChange = useCallback(
    (fileId: string, newSource: StyleSource) => {
      let didClearStyle = false;
      setFiles((prev) =>
        prev.map((f) => {
          if (f.id !== fileId) return f;
          const currentStyle = f.metadata.style;
          const newSourceStyles = availableStyles[newSource] || [];
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

  // ===== 上传处理 =====
  const handleUpload = useCallback(() => {
    if (files.length === 0) return;

    const missingRequired: string[] = [];
    for (const f of files) {
      if (!f.metadata.model_base || !f.metadata.source) {
        missingRequired.push(f.metadata.title);
      }
    }

    if (missingRequired.length > 0) {
      const displayNames = missingRequired.slice(0, 3).join(', ');
      const more = missingRequired.length > 3 ? ` 等 ${missingRequired.length} 个文件` : '';
      toast.error(`请填写必填字段（模型基底、风格大类）: ${displayNames}${more}`);
      return;
    }

    if (files[0]?.metadata.model_base && files[0]?.metadata.source) {
      saveUploadDefaults({
        model_base: files[0].metadata.model_base as ModelBase,
        source: files[0].metadata.source as StyleSource,
      });
    }

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

    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setSelectedFileId(null);

    onStartUpload(tasks);
    onClose();
  }, [files, onStartUpload, onClose]);

  // ===== 关闭处理 =====
  const handleClose = useCallback(() => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setSelectedFileId(null);
    setSelectedFileIds(new Set());
    setLastClickedId(null);
    setDraggedFileId(null);
    setDragOverFileId(null);
    setShowCloseConfirm(false);
    onClose();
  }, [files, onClose]);

  const tryClose = useCallback(() => {
    if (files.length > 0) {
      setShowCloseConfirm(true);
    } else {
      handleClose();
    }
  }, [files.length, handleClose]);

  return {
    // 文件状态
    files,
    selectedFile,
    selectedFileId,
    selectedFileIds,
    lastClickedId,

    // UI 状态
    phase,
    isDragOver,
    isLoadingFiles,
    loadingProgress,
    showStyleSuggestions,
    showCloseConfirm,
    filteredStyles,

    // 拖拽排序状态
    draggedFileId,
    dragOverFileId,

    // 文件操作
    handleFilesSelected,
    removeFile,
    removeSelectedFiles,

    // 选择操作
    handleThumbnailClick,
    toggleSelectAll,
    setSelectedFileId,
    setLastClickedId,
    setSelectedFileIds,

    // 拖拽排序操作
    handleDragStartSort,
    handleDragOverSort,
    handleDragLeaveSort,
    handleDropSort,
    handleDragEndSort,

    // 拖拽上传操作
    handleDragOver,
    handleDragLeave,
    handleDrop,

    // 元数据操作
    updateFileMetadata,
    handleSourceChange,
    copyMetadataToSelected,
    setShowStyleSuggestions,

    // 弹窗操作
    handleUpload,
    handleClose,
    tryClose,
    setShowCloseConfirm,

    // Refs
    fileInputRef,
    thumbnailContainerRef,
    isComposingRef,
  };
}
