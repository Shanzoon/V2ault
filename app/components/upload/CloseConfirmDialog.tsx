'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface CloseConfirmDialogProps {
  isOpen: boolean;
  filesCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CloseConfirmDialog({
  isOpen,
  filesCount,
  onConfirm,
  onCancel,
}: CloseConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-10 flex items-center justify-center"
        >
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onCancel}
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
              你有 <span className="text-orange-400 font-medium">{filesCount}</span> 张图片尚未上传，关闭后编辑内容将丢失。确定要关闭吗？
            </p>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-all duration-200 border border-white/[0.08]"
              >
                继续编辑
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-xl text-sm font-medium transition-all duration-200 border border-red-500/30"
              >
                确认关闭
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
