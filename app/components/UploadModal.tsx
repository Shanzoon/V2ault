'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { UploadTask } from '../hooks/useUploadQueue';
import { MODEL_BASES, STYLE_SOURCES } from '../lib/constants';
import type { ModelBase, StyleSource } from '../lib/constants';

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
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartUpload: (tasks: UploadTask[]) => void;
}

export function UploadModal({ isOpen, onClose, onStartUpload }: UploadModalProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 批量应用状态
  const [batchModelBase, setBatchModelBase] = useState<ModelBase | ''>('');
  const [batchSource, setBatchSource] = useState<StyleSource | ''>('');
  const [batchStyle, setBatchStyle] = useState('');
  const [batchImportedAt, setBatchImportedAt] = useState('');

  // 处理文件选择
  const handleFilesSelected = useCallback(
    (selectedFiles: FileList | File[]) => {
      const newFiles: FileWithPreview[] = [];
      const oversizedFiles: string[] = [];
      const currentCount = files.length;
      let skippedDueToLimit = 0;

      Array.from(selectedFiles).forEach((file, index) => {
        if (!file.type.startsWith('image/')) return;

        // 检查数量限制
        if (currentCount + newFiles.length >= MAX_FILE_COUNT) {
          skippedDueToLimit++;
          return;
        }

        if (file.size > MAX_FILE_SIZE) {
          oversizedFiles.push(file.name);
          return;
        }

        newFiles.push({
          file,
          preview: URL.createObjectURL(file),
          id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          metadata: {
            title: file.name.replace(/\.[^/.]+$/, ''),
            prompt: '',
            model_base: '',
            source: '',
            style: '',
            imported_at: '',
          },
        });
      });

      if (skippedDueToLimit > 0) {
        toast.error(`单次最多上传 ${MAX_FILE_COUNT} 张图片，已跳过 ${skippedDueToLimit} 张`);
      }

      if (oversizedFiles.length > 0) {
        const displayNames = oversizedFiles.slice(0, 3).join(', ');
        const more = oversizedFiles.length > 3 ? ` 等 ${oversizedFiles.length} 个文件` : '';
        toast.error(`超过 20MB 限制: ${displayNames}${more}`);
      }

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
        if (!selectedFileId) {
          setSelectedFileId(newFiles[0].id);
        }
      }
    },
    [files.length, selectedFileId]
  );

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFilesSelected(e.dataTransfer.files);
    },
    [handleFilesSelected]
  );

  // 删除文件
  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        const file = prev.find((f) => f.id === id);
        if (file) URL.revokeObjectURL(file.preview);
        return prev.filter((f) => f.id !== id);
      });
      if (selectedFileId === id) {
        setSelectedFileId(() => {
          const remaining = files.filter((f) => f.id !== id);
          return remaining.length > 0 ? remaining[0].id : null;
        });
      }
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
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setSelectedFileId(null);
    setBatchModelBase('');
    setBatchSource('');
    setBatchStyle('');
    setBatchImportedAt('');
    onClose();
  }, [files, onClose]);

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const selectedFile = files.find((f) => f.id === selectedFileId);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 遮罩层 - 增强毛玻璃效果 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-xl"
          />

          {/* 弹窗主体 - 毛玻璃质感 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[1200px] h-[85vh] max-h-[900px] bg-[#0d0d0d]/90 backdrop-blur-2xl rounded-3xl border border-white/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
          >
            {/* 顶部装饰光晕 */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />

            {/* 弹窗头部 */}
            <div className="relative flex items-center justify-between px-8 py-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-orange-500/10 rounded-xl">
                  <Upload className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white tracking-tight">
                    上传图片
                  </h2>
                  {files.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      已选择 <span className="text-orange-400 font-medium">{files.length}</span> / {MAX_FILE_COUNT} 张
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2.5 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200"
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

            {/* 弹窗内容 */}
            <div className="flex-1 flex overflow-hidden">
              {/* 左侧：文件列表/拖拽区 */}
              <div className="w-1/2 border-r border-white/[0.06] flex flex-col">
                {files.length === 0 ? (
                  /* 拖拽上传区 */
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 m-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                      isDragOver
                        ? 'border-orange-500/60 bg-orange-500/5 scale-[0.99]'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className={`p-5 rounded-2xl mb-5 transition-all duration-300 ${
                      isDragOver ? 'bg-orange-500/10' : 'bg-white/[0.03]'
                    }`}>
                      <Upload
                        className={`w-10 h-10 transition-colors duration-300 ${
                          isDragOver ? 'text-orange-400' : 'text-gray-600'
                        }`}
                      />
                    </div>
                    <p className={`text-base font-medium mb-2 transition-colors duration-300 ${
                      isDragOver ? 'text-orange-300' : 'text-gray-400'
                    }`}>
                      拖拽图片到这里
                    </p>
                    <p className="text-gray-600 text-sm">
                      或点击选择文件
                    </p>
                    <p className="text-gray-700 text-xs mt-4">
                      单个文件最大 20MB · 单次最多 {MAX_FILE_COUNT} 张
                    </p>
                  </div>
                ) : (
                  /* 文件预览列表 */
                  <div
                    className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {files.map((f) => (
                        <div
                          key={f.id}
                          onClick={() => setSelectedFileId(f.id)}
                          className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${
                            selectedFileId === f.id
                              ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-[#0d0d0d] scale-[0.98]'
                              : 'hover:ring-1 hover:ring-white/20 hover:scale-[0.98]'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={f.preview}
                            alt={f.metadata.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {/* 选中指示器 */}
                          {selectedFileId === f.id && (
                            <div className="absolute inset-0 bg-orange-500/10 pointer-events-none" />
                          )}
                          {/* 删除按钮 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(f.id);
                            }}
                            className="absolute bottom-1.5 right-1.5 p-1.5 bg-black/70 hover:bg-red-500/90 text-white/70 hover:text-white rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {/* 添加更多按钮 */}
                      {files.length < MAX_FILE_COUNT && (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-orange-500/30 flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-orange-500/5 group"
                        >
                          <Upload className="w-5 h-5 text-gray-600 group-hover:text-orange-400 transition-colors" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* 右侧：元数据编辑 */}
              <div className="w-1/2 flex flex-col overflow-hidden bg-white/[0.01]">
                {selectedFile ? (
                  <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {/* 大图预览 */}
                    <div className="aspect-video rounded-2xl overflow-hidden bg-black/40 flex items-center justify-center ring-1 ring-white/[0.06]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedFile.preview}
                        alt={selectedFile.metadata.title}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>

                    {/* 标题 */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        标题
                      </label>
                      <input
                        type="text"
                        value={selectedFile.metadata.title}
                        onChange={(e) =>
                          updateFileMetadata(selectedFile.id, { title: e.target.value })
                        }
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 focus:bg-white/[0.05] focus:outline-none transition-all duration-200"
                        placeholder="输入标题..."
                      />
                    </div>

                    {/* 模型基底 (model_base) - 必填 */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        模型基底 <span className="text-orange-400">*</span>
                      </label>
                      <select
                        value={selectedFile.metadata.model_base}
                        onChange={(e) =>
                          updateFileMetadata(selectedFile.id, {
                            model_base: e.target.value as ModelBase | '',
                          })
                        }
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:border-orange-500/50 focus:bg-white/[0.05] focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-[#1a1a1a]">选择模型基底...</option>
                        {MODEL_BASES.map((base) => (
                          <option key={base} value={base} className="bg-[#1a1a1a]">
                            {base}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 风格大类 (source) - 必填 */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        风格大类 <span className="text-orange-400">*</span>
                      </label>
                      <div className="flex gap-2">
                        {STYLE_SOURCES.map((src) => (
                          <button
                            key={src}
                            type="button"
                            onClick={() =>
                              updateFileMetadata(selectedFile.id, { source: src })
                            }
                            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                              selectedFile.metadata.source === src
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                : 'bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:bg-white/[0.06] hover:text-white'
                            }`}
                          >
                            {src}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 具体风格 (style) */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        具体风格
                      </label>
                      <input
                        type="text"
                        value={selectedFile.metadata.style}
                        onChange={(e) =>
                          updateFileMetadata(selectedFile.id, { style: e.target.value })
                        }
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 focus:bg-white/[0.05] focus:outline-none transition-all duration-200"
                        placeholder="例如：赛博朋克、水墨风"
                      />
                    </div>

                    {/* 风格参照 (imported_at) */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        风格参照 (Style Ref/LoRA)
                      </label>
                      <input
                        type="text"
                        value={selectedFile.metadata.imported_at}
                        onChange={(e) =>
                          updateFileMetadata(selectedFile.id, { imported_at: e.target.value })
                        }
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 focus:bg-white/[0.05] focus:outline-none transition-all duration-200"
                        placeholder="输入风格参照或 LoRA 名称..."
                      />
                    </div>

                    {/* 提示词 */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        提示词
                      </label>
                      <textarea
                        value={selectedFile.metadata.prompt}
                        onChange={(e) =>
                          updateFileMetadata(selectedFile.id, { prompt: e.target.value })
                        }
                        className="w-full h-32 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 focus:bg-white/[0.05] focus:outline-none resize-none transition-all duration-200 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
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
                  <div className="p-5 border-t border-white/[0.06] bg-black/20">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
                      批量应用到所有图片
                    </p>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <select
                          value={batchModelBase}
                          onChange={(e) => setBatchModelBase(e.target.value as ModelBase | '')}
                          className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white focus:border-orange-500/50 focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-[#1a1a1a]">模型基底</option>
                          {MODEL_BASES.map((base) => (
                            <option key={base} value={base} className="bg-[#1a1a1a]">
                              {base}
                            </option>
                          ))}
                        </select>
                        <select
                          value={batchSource}
                          onChange={(e) => setBatchSource(e.target.value as StyleSource | '')}
                          className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white focus:border-orange-500/50 focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-[#1a1a1a]">风格大类</option>
                          {STYLE_SOURCES.map((src) => (
                            <option key={src} value={src} className="bg-[#1a1a1a]">
                              {src}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={batchStyle}
                          onChange={(e) => setBatchStyle(e.target.value)}
                          placeholder="具体风格"
                          className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 focus:outline-none transition-all duration-200"
                        />
                        <input
                          type="text"
                          value={batchImportedAt}
                          onChange={(e) => setBatchImportedAt(e.target.value)}
                          placeholder="风格参照"
                          className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 focus:outline-none transition-all duration-200"
                        />
                        <button
                          onClick={applyBatch}
                          className="px-5 py-2.5 bg-white/[0.06] hover:bg-orange-500/20 hover:text-orange-300 text-white rounded-xl text-sm font-medium transition-all duration-200 border border-transparent hover:border-orange-500/30"
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
            <div className="relative px-8 py-5 border-t border-white/[0.06] flex items-center justify-between bg-black/20">
              <p className="text-sm text-gray-500">
                {files.length === 0
                  ? '暂无待上传图片'
                  : `${files.length} 张图片待上传`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-all duration-200 border border-white/[0.06]"
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
        </div>
      )}
    </AnimatePresence>
  );
}
