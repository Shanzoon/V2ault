'use client';

import { useRef } from 'react';
import {
  Image as ImageIcon,
  Box,
  Palette,
  Layers,
  Sparkles,
  FileText,
  Copy,
} from 'lucide-react';
import { MODEL_BASES, STYLE_SOURCES } from '../../lib/constants';
import type { StyleSource } from '../../lib/constants';
import type { FileWithPreview, FileMetadata } from '../../hooks/useUploadModal';

interface MetadataEditorProps {
  selectedFile: FileWithPreview | undefined;
  filesCount: number;
  selectedFileIds: Set<string>;
  selectedFileId: string | null;
  filteredStyles: string[];
  showStyleSuggestions: boolean;
  onUpdateMetadata: (id: string, updates: Partial<FileMetadata>) => void;
  onSourceChange: (fileId: string, source: StyleSource) => void;
  onCopyMetadata: () => void;
  onShowStyleSuggestions: (show: boolean) => void;
}

export function MetadataEditor({
  selectedFile,
  filesCount,
  selectedFileIds,
  selectedFileId,
  filteredStyles,
  showStyleSuggestions,
  onUpdateMetadata,
  onSourceChange,
  onCopyMetadata,
  onShowStyleSuggestions,
}: MetadataEditorProps) {
  const isComposingRef = useRef(false);

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="p-5 bg-white/[0.02] rounded-2xl mx-auto w-fit mb-4">
            <ImageIcon className="w-12 h-12 text-gray-700" />
          </div>
          <p className="text-gray-600 text-sm">选择一张图片编辑元数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {/* 标题 */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <FileText className="w-3.5 h-3.5 text-gray-500" />
          标题
        </label>
        <input
          type="text"
          value={selectedFile.metadata.title}
          onChange={(e) =>
            onUpdateMetadata(selectedFile.id, { title: e.target.value })
          }
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 focus:bg-white/[0.05] focus:outline-none transition-all duration-200"
          placeholder="输入标题..."
        />
      </div>

      {/* 模型基底 - 点选按钮 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <Box className="w-3.5 h-3.5 text-orange-400" />
          模型基底 <span className="text-orange-400">*</span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {MODEL_BASES.map((base) => (
            <button
              key={base}
              type="button"
              onClick={() =>
                onUpdateMetadata(selectedFile.id, { model_base: base })
              }
              className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                selectedFile.metadata.model_base === base
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-lg shadow-orange-500/10'
                  : 'bg-white/[0.03] text-gray-400 border border-white/[0.08] hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {base}
            </button>
          ))}
        </div>
      </div>

      {/* 风格大类 - 点选按钮 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <Palette className="w-3.5 h-3.5 text-orange-400" />
          风格大类 <span className="text-orange-400">*</span>
        </label>
        <div className="flex gap-2">
          {STYLE_SOURCES.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => onSourceChange(selectedFile.id, src)}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                selectedFile.metadata.source === src
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-lg shadow-orange-500/10'
                  : 'bg-white/[0.03] text-gray-400 border border-white/[0.08] hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {src}
            </button>
          ))}
        </div>
      </div>

      {/* 具体风格 - 带输入预测 */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5 text-orange-400" />
          具体风格
        </label>
        <div className="relative">
          <input
            type="text"
            value={selectedFile.metadata.style}
            onChange={(e) => {
              onUpdateMetadata(selectedFile.id, { style: e.target.value });
              onShowStyleSuggestions(true);
            }}
            onFocus={() => onShowStyleSuggestions(true)}
            onBlur={() => setTimeout(() => onShowStyleSuggestions(false), 200)}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 focus:bg-white/[0.05] focus:outline-none transition-all duration-200"
            placeholder={selectedFile.metadata.source ? "输入或选择风格..." : "请先选择风格大类"}
            disabled={!selectedFile.metadata.source}
          />
          {/* 下拉建议 */}
          {showStyleSuggestions && filteredStyles.length > 0 && selectedFile.metadata.source && (
            <div className="absolute z-20 w-full mt-1 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl overflow-hidden">
              <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {filteredStyles.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onMouseDown={() => {
                      onUpdateMetadata(selectedFile.id, { style });
                      onShowStyleSuggestions(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-orange-500/10 hover:text-orange-300 transition-colors"
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 风格参照 */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-orange-400" />
          风格参照 (Style Ref/LoRA)
        </label>
        <input
          type="text"
          value={selectedFile.metadata.imported_at}
          onChange={(e) => {
            onUpdateMetadata(selectedFile.id, { imported_at: e.target.value });
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false;
            onUpdateMetadata(selectedFile.id, { imported_at: e.currentTarget.value });
          }}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 focus:bg-white/[0.05] focus:outline-none transition-all duration-200"
          placeholder="输入风格代码或 LoRA 名称..."
        />
      </div>

      {/* 提示词 */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <FileText className="w-3.5 h-3.5 text-gray-500" />
          提示词
        </label>
        <textarea
          value={selectedFile.metadata.prompt}
          onChange={(e) =>
            onUpdateMetadata(selectedFile.id, { prompt: e.target.value })
          }
          className="w-full h-28 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 focus:bg-white/[0.05] focus:outline-none resize-none transition-all duration-200 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          placeholder="输入生成提示词..."
        />
      </div>

      {/* 复制元数据按钮 */}
      {filesCount > 1 && (
        <button
          onClick={onCopyMetadata}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 bg-orange-500/10 text-orange-300 border border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/30"
        >
          <Copy className="w-4 h-4" />
          {selectedFileIds.size > 0
            ? `复制设置到已选的 ${selectedFileIds.size - (selectedFileIds.has(selectedFileId!) ? 1 : 0)} 张图片`
            : `复制设置到其他 ${filesCount - 1} 张图片`}
        </button>
      )}
    </div>
  );
}
