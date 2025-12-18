'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, MoreHorizontal, X, Loader2 } from 'lucide-react';
import { BatchEditMenu } from './BatchEditMenu';
import { useClickOutside } from '../hooks';
import type { StyleSource } from '../lib/constants';

interface AvailableStyles {
  '2D': string[];
  '3D': string[];
  'Real': string[];
}

interface SelectionActionBarProps {
  selectedCount: number;
  isVisible: boolean;
  onDownload: () => void;
  onClose: () => void;
  isProcessing: boolean;
  isAdmin: boolean;
  // 批量操作回调
  onBatchLike: () => void;
  onBatchDelete: () => void;
  onBatchUpdateModel: (model: string) => void;
  onBatchUpdateStyle: (source: StyleSource, style: string) => void;
  // 可用风格列表
  availableStyles: AvailableStyles;
}

export function SelectionActionBar({
  selectedCount,
  isVisible,
  onDownload,
  onClose,
  isProcessing,
  isAdmin,
  onBatchLike,
  onBatchDelete,
  onBatchUpdateModel,
  onBatchUpdateStyle,
  availableStyles,
}: SelectionActionBarProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  const closeMenu = useCallback(() => setShowMoreMenu(false), []);
  useClickOutside(menuRef, closeMenu, showMoreMenu);

  // 关闭时重置菜单状态
  useEffect(() => {
    if (!isVisible) {
      setShowMoreMenu(false);
    }
  }, [isVisible]);

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

            {/* 下载按钮 */}
            <button
              onClick={onDownload}
              disabled={isProcessing}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="下载"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </button>

            {/* 更多按钮 */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`p-2.5 rounded-xl transition-colors ${
                  showMoreMenu
                    ? 'bg-white/15 text-white'
                    : 'bg-white/5 hover:bg-white/10 text-white'
                }`}
                title="更多操作"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {/* 下拉菜单 */}
              <AnimatePresence>
                {showMoreMenu && (
                  <BatchEditMenu
                    isAdmin={isAdmin}
                    onBatchLike={() => {
                      onBatchLike();
                      setShowMoreMenu(false);
                    }}
                    onBatchDelete={() => {
                      onBatchDelete();
                      setShowMoreMenu(false);
                    }}
                    onBatchUpdateModel={(model) => {
                      onBatchUpdateModel(model);
                      setShowMoreMenu(false);
                    }}
                    onBatchUpdateStyle={(source, style) => {
                      onBatchUpdateStyle(source, style);
                      setShowMoreMenu(false);
                    }}
                    availableStyles={availableStyles}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* 分隔线 */}
            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-white transition-colors"
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
