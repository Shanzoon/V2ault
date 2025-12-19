'use client';

import { memo, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, RefreshCw, Trash2, Clock } from 'lucide-react';
import { useClickOutside } from '../hooks';
import type { Image } from '../types';

interface TrashImageCardProps {
  img: Image;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: (id: number) => void;
  onRestore?: (id: number) => void;
  onDelete?: (id: number) => void;
  isAdmin?: boolean;
}

// 格式化删除时间
function formatDeletedAt(timestamp: number | null | undefined): string {
  if (!timestamp) return '未知';
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  return date.toLocaleDateString('zh-CN');
}

export const TrashImageCard = memo(function TrashImageCard({
  img,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  onRestore,
  onDelete,
  isAdmin,
}: TrashImageCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setShowMenu(false), []);
  useClickOutside(menuRef, closeMenu, showMenu);

  const smallUrl = `/api/image/${img.id}?w=600`;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{
        layout: { duration: 0.25, ease: 'easeOut' },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      }}
      className={`relative group bg-gray-900 overflow-hidden rounded-lg ${
        isSelected ? 'ring-[3px] ring-red-500 ring-offset-1 ring-offset-black/50' : ''
      }`}
      onClick={() => {
        if (isSelectionMode) {
          onToggleSelection(img.id);
        }
      }}
    >
      {/* 选择框 */}
      {isSelectionMode && (
        <div
          className={`absolute top-3 right-3 z-20 w-5 h-5 rounded border shadow-sm flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-red-500 border-red-500 text-white'
              : 'bg-black/40 border-white/60 hover:bg-black/60'
          }`}
        >
          {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
        </div>
      )}

      {/* 操作菜单 */}
      {!isSelectionMode && isAdmin && (
        <div ref={menuRef} className="absolute top-3 right-3 z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-2 opacity-0 group-hover:opacity-100 transition-all duration-300"
          >
            <div className="flex flex-col gap-[5px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              <div className="w-[5px] h-[5px] bg-white rounded-full" />
              <div className="w-[5px] h-[5px] bg-white rounded-full" />
              <div className="w-[5px] h-[5px] bg-white rounded-full" />
            </div>
          </button>

          {showMenu && (
            <div className="absolute top-full right-0 mt-1 py-1 min-w-[120px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg overflow-hidden">
              {/* 恢复 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore?.(img.id);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-green-400 hover:bg-green-500/10 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                恢复
              </button>

              {/* 永久删除 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(img.id);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                永久删除
              </button>
            </div>
          )}
        </div>
      )}

      {/* 图片 */}
      <div
        className="w-full aspect-square relative"
        style={{ backgroundColor: img.dominant_color || '#1f2937' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={smallUrl}
          alt={img.filename}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } group-hover:scale-105`}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
        />

        {/* 渐变遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100" />

        {/* 删除时间标签 */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
            <Clock className="w-3 h-3" />
            <span>删除于 {formatDeletedAt(img.deleted_at)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}, (prev, next) => {
  return (
    prev.img.id === next.img.id &&
    prev.isSelectionMode === next.isSelectionMode &&
    prev.isSelected === next.isSelected &&
    prev.isAdmin === next.isAdmin
  );
});
