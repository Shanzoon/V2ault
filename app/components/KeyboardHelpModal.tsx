'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  hideBackdrop?: boolean;
}

const SHORTCUTS = [
  { key: 'Q', description: '切换布局大小' },
  { key: 'R', description: '随机排列' },
  { key: '[ / ]', description: '切换风格大类' },
  { key: 'W / E', description: '切换具体风格' },
  { key: '← / →', description: '切换图片（Modal）' },
  { key: 'Delete', description: '删除图片' },
  { key: 'ESC', description: '退出/关闭' },
  { key: '?', description: '显示快捷键帮助' },
];

export function KeyboardHelpModal({ isOpen, onClose, hideBackdrop }: KeyboardHelpModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          {!hideBackdrop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/50 z-[100]"
            />
          )}

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[320px]"
            data-onboarding="shortcuts-modal"
          >
            <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-orange-400" />
                  <h2 className="text-sm font-bold text-white">快捷键</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Shortcuts List */}
              <div className="p-4 space-y-2">
                {SHORTCUTS.map(({ key, description }) => (
                  <div key={key} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-gray-300">{description}</span>
                    <kbd className="px-2 py-1 bg-white/10 border border-white/10 rounded text-[10px] font-mono text-orange-400">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-white/5">
                <p className="text-[10px] text-gray-500 text-center">
                  按 ESC 或 ? 关闭
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
