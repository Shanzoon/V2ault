'use client';

import { Upload, X } from 'lucide-react';

const MAX_FILE_COUNT = 500;

interface UploadDropZoneProps {
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClickSelect: () => void;
  onClose: () => void;
}

export function UploadDropZone({
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClickSelect,
  onClose,
}: UploadDropZoneProps) {
  return (
    <div className="relative p-8">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20">
            <Upload className="w-5 h-5 text-orange-400" />
          </div>
          <h2 className="text-lg font-semibold text-white tracking-tight">
            上传图片
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 拖拽上传区 */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onClickSelect}
        className={`aspect-[4/3] border-2 border-dashed rounded-2xl
          flex flex-col items-center justify-center cursor-pointer
          transition-all duration-300 ${
          isDragOver
            ? 'border-orange-500/60 bg-orange-500/10 scale-[0.98]'
            : 'border-white/15 hover:border-white/25 hover:bg-white/[0.03]'
        }`}
      >
        <div className={`p-4 rounded-2xl mb-4 transition-all duration-300 ${
          isDragOver ? 'bg-orange-500/20' : 'bg-white/[0.05]'
        }`}>
          <Upload className={`w-8 h-8 transition-colors duration-300 ${
            isDragOver ? 'text-orange-400' : 'text-gray-500'
          }`} />
        </div>
        <p className={`text-sm font-medium mb-1 transition-colors duration-300 ${
          isDragOver ? 'text-orange-300' : 'text-gray-300'
        }`}>
          拖拽图片到这里
        </p>
        <p className="text-gray-500 text-xs">或点击选择文件</p>
        <p className="text-gray-600 text-xs mt-4">
          单个最大 20MB · 单次最多 {MAX_FILE_COUNT} 张
        </p>
      </div>
    </div>
  );
}
