'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Trash2, X, Loader2 } from 'lucide-react';

interface TrashActionBarProps {
  selectedCount: number;
  isVisible: boolean;
  isAdmin: boolean;
  isProcessing: boolean;
  onRestore: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function TrashActionBar({
  selectedCount,
  isVisible,
  isAdmin,
  isProcessing,
  onRestore,
  onDelete,
  onClose,
}: TrashActionBarProps) {
  return (
    <AnimatePresence>
      {isVisible && selectedCount > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80]"
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
            {/* 选中数量 */}
            <div className="flex items-center gap-2 pr-3 border-r border-white/10">
              <span className="text-sm font-bold text-white tabular-nums">
                {selectedCount}
              </span>
              <span className="text-xs text-gray-400">已选</span>
            </div>

            {/* 恢复按钮 */}
            {isAdmin && (
              <button
                onClick={onRestore}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="恢复选中图片"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                恢复
              </button>
            )}

            {/* 永久删除按钮 */}
            {isAdmin && (
              <button
                onClick={onDelete}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="永久删除选中图片"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                永久删除
              </button>
            )}

            {/* 分隔线 */}
            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="退出选择"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
