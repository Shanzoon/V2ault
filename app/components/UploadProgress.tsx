'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, ChevronUp, Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { UploadQueueState } from '../hooks/useUploadQueue';

interface UploadProgressProps {
  state: UploadQueueState;
  isMinimized: boolean;
  isVisible: boolean;
  onToggleMinimize: () => void;
  onCancel: () => void;
  onClear: () => void;
}

export function UploadProgress({
  state,
  isMinimized,
  isVisible,
  onToggleMinimize,
  onCancel,
  onClear,
}: UploadProgressProps) {
  const { tasks, isUploading, totalCount, completedCount, failedCount } = state;

  // 计算进度百分比
  const progressPercent =
    totalCount > 0 ? Math.round(((completedCount + failedCount) / totalCount) * 100) : 0;

  // 获取当前上传的文件名
  const currentTask = tasks.find((t) => t.status === 'uploading');
  const currentFileName = currentTask?.metadata.title || currentTask?.file.name || '';

  // 是否全部完成
  const isComplete = !isUploading && totalCount > 0 && completedCount + failedCount === totalCount;

  if (!isVisible || totalCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.9 }}
        className="fixed top-4 right-6 z-[60]"
      >
        {isMinimized ? (
          /* 最小化状态 */
          <motion.div
            layout
            className="bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden cursor-pointer hover:bg-[#222]"
            onClick={onToggleMinimize}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <ChevronUp className="w-4 h-4 text-gray-500" />
              {isUploading ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              ) : isComplete ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Upload className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-sm text-white font-medium">
                {completedCount + failedCount}/{totalCount}
              </span>
              <span className="text-sm text-gray-500">{progressPercent}%</span>
            </div>
          </motion.div>
        ) : (
          /* 展开状态 */
          <motion.div
            layout
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden w-[340px]"
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20">
              <div className="flex items-center gap-2">
                {isUploading ? (
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                ) : isComplete ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Upload className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-sm font-bold text-white">
                  {isComplete ? '上传完成' : '上传进度'}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {completedCount + failedCount}/{totalCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onToggleMinimize}
                  className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                  title="最小化"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={onClear}
                  className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                  title="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 进度条 */}
            <div className="px-4 py-3">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    isComplete
                      ? failedCount > 0
                        ? 'bg-gradient-to-r from-green-500 to-yellow-500'
                        : 'bg-green-500'
                      : 'bg-gradient-to-r from-cyan-500 to-cyan-400'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{progressPercent}%</span>
                <span>
                  {isUploading
                    ? `正在上传 ${completedCount + failedCount + 1}/${totalCount}`
                    : isComplete
                      ? '已完成'
                      : '等待中'}
                </span>
              </div>
            </div>

            {/* 当前文件 */}
            {isUploading && currentFileName && (
              <div className="px-4 pb-3">
                <p className="text-xs text-gray-500 truncate">
                  当前: <span className="text-gray-400">{currentFileName}</span>
                </p>
              </div>
            )}

            {/* 统计信息 */}
            <div className="px-4 pb-3 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <Check className="w-3 h-3 text-green-400" />
                <span className="text-gray-400">成功: {completedCount}</span>
              </div>
              {failedCount > 0 && (
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-red-400" />
                  <span className="text-gray-400">失败: {failedCount}</span>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="px-4 pb-4 flex gap-2">
              {isUploading ? (
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors border border-red-500/20"
                >
                  取消上传
                </button>
              ) : (
                <button
                  onClick={onClear}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors"
                >
                  关闭
                </button>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
