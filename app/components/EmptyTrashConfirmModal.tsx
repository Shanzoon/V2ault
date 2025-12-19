'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface EmptyTrashConfirmModalProps {
  isOpen: boolean;
  totalCount: number;
  isProcessing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EmptyTrashConfirmModal({
  isOpen,
  totalCount,
  isProcessing,
  onConfirm,
  onCancel,
}: EmptyTrashConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#1a1a1a] rounded-xl border border-white/10 p-6 w-[380px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-red-500/10 rounded-full shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">
                  清空回收站
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  确定要永久删除回收站中的{' '}
                  <span className="text-white font-bold">{totalCount}</span>{' '}
                  张图片吗？
                </p>
                <p className="text-xs text-red-400 mt-2">
                  此操作无法撤销，图片将被彻底删除。
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onCancel}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                disabled={isProcessing}
                className="px-4 py-2.5 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    删除中...
                  </>
                ) : (
                  '确认清空'
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
