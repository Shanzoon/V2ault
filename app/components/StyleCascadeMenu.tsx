'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { STYLE_SOURCES, type StyleSource } from '../lib/constants';

interface AvailableStyles {
  '2D': string[];
  '3D': string[];
  'Real': string[];
}

interface StyleCascadeMenuProps {
  availableStyles: AvailableStyles;
  onSelect: (source: StyleSource, style: string) => void;
}

export function StyleCascadeMenu({
  availableStyles,
  onSelect,
}: StyleCascadeMenuProps) {
  const [styleSource, setStyleSource] = useState<StyleSource | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute left-full bottom-0 ml-1 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden"
    >
      {!styleSource ? (
        // 第一级：风格大类（2D/3D/Real）
        <div className="min-w-[100px]">
          {STYLE_SOURCES.map((source) => (
            <button
              key={source}
              onClick={() => setStyleSource(source)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors"
            >
              {source}
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          ))}
        </div>
      ) : (
        // 第二级：具体风格（最多显示6个，其余滚动）
        <div className="min-w-[160px] max-h-[264px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {/* 返回按钮 */}
          <button
            onClick={() => setStyleSource(null)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-500 hover:bg-white/5 border-b border-white/5 transition-colors sticky top-0 bg-[#1a1a1a]/95 backdrop-blur-xl z-10"
          >
            <ChevronLeft className="w-3 h-3" />
            返回
          </button>

          {availableStyles[styleSource] && availableStyles[styleSource].length > 0 ? (
            availableStyles[styleSource].map((style) => (
              <button
                key={style}
                onClick={() => onSelect(styleSource, style)}
                className="w-full px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 text-left transition-colors"
              >
                {style}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-xs text-gray-500">
              暂无 {styleSource} 风格
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
