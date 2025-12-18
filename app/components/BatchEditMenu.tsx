'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Trash2, Box, Palette, ChevronRight } from 'lucide-react';
import { MODEL_BASES, STYLE_SOURCES, type StyleSource } from '../lib/constants';
import { StyleCascadeMenu } from './StyleCascadeMenu';

interface AvailableStyles {
  '2D': string[];
  '3D': string[];
  'Real': string[];
}

interface BatchEditMenuProps {
  isAdmin: boolean;
  onBatchLike: () => void;
  onBatchDelete: () => void;
  onBatchUpdateModel: (model: string) => void;
  onBatchUpdateStyle: (source: StyleSource, style: string) => void;
  availableStyles: AvailableStyles;
}

export function BatchEditMenu({
  isAdmin,
  onBatchLike,
  onBatchDelete,
  onBatchUpdateModel,
  onBatchUpdateStyle,
  availableStyles,
}: BatchEditMenuProps) {
  const [activeSubmenu, setActiveSubmenu] = useState<'model' | 'style' | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full right-0 mb-2 min-w-[180px] bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-visible"
    >
      {/* 喜欢 */}
      <button
        onClick={onBatchLike}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-white/5 transition-colors"
      >
        <Heart className="w-4 h-4" />
        批量喜欢
      </button>

      {/* 删除 - 仅管理员 */}
      {isAdmin && (
        <button
          onClick={onBatchDelete}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          批量删除
        </button>
      )}

      <div className="h-px bg-white/5 mx-2" />

      {/* 修改模型 - 仅管理员 */}
      {isAdmin && (
        <div
          className="relative"
          onMouseEnter={() => setActiveSubmenu('model')}
          onMouseLeave={() => setActiveSubmenu(null)}
        >
          <button
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-3">
              <Box className="w-4 h-4" />
              修改模型为
            </span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>

          {/* 模型子菜单 */}
          {activeSubmenu === 'model' && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute left-full bottom-0 ml-1 min-w-[140px] max-h-[264px] overflow-y-auto bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
            >
              {MODEL_BASES.map((model) => (
                <button
                  key={model}
                  onClick={() => onBatchUpdateModel(model)}
                  className="w-full px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 text-left transition-colors"
                >
                  {model}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* 修改风格 - 仅管理员，二级菜单 */}
      {isAdmin && (
        <div
          className="relative"
          onMouseEnter={() => setActiveSubmenu('style')}
          onMouseLeave={() => setActiveSubmenu(null)}
        >
          <button
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-3">
              <Palette className="w-4 h-4" />
              修改风格为
            </span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>

          {/* 风格二级菜单 */}
          {activeSubmenu === 'style' && (
            <StyleCascadeMenu
              availableStyles={availableStyles}
              onSelect={onBatchUpdateStyle}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}
