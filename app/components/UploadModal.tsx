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

// Model Base 预设选项
const MODEL_BASE_OPTIONS = [
  { id: 1, name: 'SD 1.5' },
  { id: 2, name: 'SDXL' },
  { id: 3, name: 'Flux' },
  { id: 4, name: 'Illustrious' },
  { id: 5, name: 'NoobAI' },
  { id: 6, name: 'Pony' },
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILE_COUNT = 500; // 单次最大文件数量

interface FileMetadata {
  title: string;
  prompt: string;
  style: string;
  modelBaseId: number | null;
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
  const [batchStyle, setBatchStyle] = useState('');
  const [batchModelBaseId, setBatchModelBaseId] = useState<number | null>(null);

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
            style: '',
            modelBaseId: null,
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
    if (!batchStyle && batchModelBaseId === null) {
      toast.error('请至少填写一项批量应用内容');
      return;
    }
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        metadata: {
          ...f.metadata,
          ...(batchStyle ? { style: batchStyle } : {}),
          ...(batchModelBaseId !== null ? { modelBaseId: batchModelBaseId } : {}),
        },
      }))
    );
    toast.success('已批量应用设置');
  }, [batchStyle, batchModelBaseId]);

  // 开始上传（传递任务到全局队列）
  const handleUpload = useCallback(() => {
    if (files.length === 0) return;

    // 构建任务列表
    const tasks: UploadTask[] = files.map((f) => ({
      id: f.id,
      file: f.file,
      metadata: {
        title: f.metadata.title,
        prompt: f.metadata.prompt,
        style: f.metadata.style,
        modelBaseId: f.metadata.modelBaseId,
      },
      status: 'pending' as const,
    }));

    // 清理预览 URL
    files.forEach((f) => URL.revokeObjectURL(f.preview));

    // 重置状态
    setFiles([]);
    setSelectedFileId(null);
    setBatchStyle('');
    setBatchModelBaseId(null);

    // 传递任务并关闭弹窗
    onStartUpload(tasks);
    onClose();
  }, [files, onStartUpload, onClose]);

  // 关闭时清理
  const handleClose = useCallback(() => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setSelectedFileId(null);
    setBatchStyle('');
    setBatchModelBaseId(null);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* 弹窗主体 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-[90vw] max-w-[1200px] h-[85vh] bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
          >
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  上传图片
                </h2>
                {files.length > 0 && (
                  <span className="text-xs text-gray-500 bg-white/10 px-2 py-1 rounded">
                    {files.length} / {MAX_FILE_COUNT}
                  </span>
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 数量警告 */}
            {files.length >= MAX_FILE_COUNT * 0.9 && (
              <div className="mx-6 mt-4 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-yellow-400">
                  接近数量上限 ({files.length}/{MAX_FILE_COUNT})
                </span>
              </div>
            )}

            {/* 弹窗内容 */}
            <div className="flex-1 flex overflow-hidden">
              {/* 左侧：文件列表/拖拽区 */}
              <div className="w-1/2 border-r border-white/10 flex flex-col">
                {files.length === 0 ? (
                  /* 拖拽上传区 */
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 m-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      isDragOver
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                    }`}
                  >
                    <Upload
                      className={`w-16 h-16 mb-4 ${isDragOver ? 'text-cyan-400' : 'text-gray-600'}`}
                    />
                    <p className="text-gray-400 text-lg font-medium mb-2">
                      拖拽图片到这里
                    </p>
                    <p className="text-gray-600 text-sm">
                      单个文件最大 20MB，单次最多 {MAX_FILE_COUNT} 张
                    </p>
                  </div>
                ) : (
                  /* 文件预览列表 */
                  <div
                    className="flex-1 overflow-y-auto p-4"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {files.map((f) => (
                        <div
                          key={f.id}
                          onClick={() => setSelectedFileId(f.id)}
                          className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                            selectedFileId === f.id
                              ? 'border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                              : 'border-transparent hover:border-white/20'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={f.preview}
                            alt={f.metadata.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {/* 删除按钮 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(f.id);
                            }}
                            className="absolute bottom-1 right-1 p-1 bg-black/60 hover:bg-red-500 text-white rounded transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100"
                            style={{ opacity: selectedFileId === f.id ? 1 : undefined }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {/* 添加更多按钮 */}
                      {files.length < MAX_FILE_COUNT && (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square rounded-lg border-2 border-dashed border-white/20 hover:border-white/40 flex items-center justify-center cursor-pointer transition-colors hover:bg-white/5"
                        >
                          <Upload className="w-6 h-6 text-gray-600" />
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
              <div className="w-1/2 flex flex-col overflow-hidden">
                {selectedFile ? (
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* 大图预览 */}
                    <div className="aspect-video rounded-lg overflow-hidden bg-black/40 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedFile.preview}
                        alt={selectedFile.metadata.title}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>

                    {/* 标题 */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        标题
                      </label>
                      <input
                        type="text"
                        value={selectedFile.metadata.title}
                        onChange={(e) =>
                          updateFileMetadata(selectedFile.id, { title: e.target.value })
                        }
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
                        placeholder="输入标题..."
                      />
                    </div>

                    {/* 风格 */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        风格
                      </label>
                      <input
                        type="text"
                        value={selectedFile.metadata.style}
                        onChange={(e) =>
                          updateFileMetadata(selectedFile.id, { style: e.target.value })
                        }
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
                        placeholder="如: Anime, Realistic, Fantasy..."
                      />
                    </div>

                    {/* 提示词 */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        提示词
                      </label>
                      <textarea
                        value={selectedFile.metadata.prompt}
                        onChange={(e) =>
                          updateFileMetadata(selectedFile.id, { prompt: e.target.value })
                        }
                        className="w-full h-32 bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none resize-none"
                        placeholder="输入生成提示词..."
                      />
                    </div>

                    {/* Model Base */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Model Base
                      </label>
                      <select
                        value={selectedFile.metadata.modelBaseId ?? ''}
                        onChange={(e) =>
                          updateFileMetadata(selectedFile.id, {
                            modelBaseId: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="">选择模型基础...</option>
                        {MODEL_BASE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-gray-600">
                      <ImageIcon className="w-16 h-16 mx-auto mb-4" />
                      <p>选择一张图片编辑元数据</p>
                    </div>
                  </div>
                )}

                {/* 批量操作区 */}
                {files.length > 1 && (
                  <div className="p-4 border-t border-white/10 bg-black/20">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      批量应用到所有图片
                    </p>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={batchStyle}
                        onChange={(e) => setBatchStyle(e.target.value)}
                        placeholder="风格"
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                      />
                      <select
                        value={batchModelBaseId ?? ''}
                        onChange={(e) =>
                          setBatchModelBaseId(e.target.value ? Number(e.target.value) : null)
                        }
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="">Model Base</option>
                        {MODEL_BASE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={applyBatch}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        应用
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 弹窗底部 */}
            <div className="p-6 border-t border-white/10 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {files.length === 0
                  ? '暂无待上传图片'
                  : `${files.length} 张图片待上传`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleUpload}
                  disabled={files.length === 0}
                  className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
