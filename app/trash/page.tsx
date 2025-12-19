'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { useTrashImages } from '../hooks/useTrashImages';
import { useSelection } from '../hooks/useSelection';
import { useAuth } from '../hooks/useAuth';
import { TrashImageGrid } from '../components/TrashImageGrid';
import { TrashActionBar } from '../components/TrashActionBar';
import { EmptyTrashConfirmModal } from '../components/EmptyTrashConfirmModal';

export default function TrashPage() {
  const { isAdmin } = useAuth();
  const {
    images,
    totalCount,
    isLoading,
    hasMore,
    loadMoreRef,
    error,
    refetch,
    removeImage,
    removeImages,
  } = useTrashImages();

  const {
    isSelectionMode,
    setIsSelectionMode,
    selectedImageIds,
    setSelectedIds,
    toggleSelection,
    clearSelection,
  } = useSelection();

  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 恢复单张图片
  const handleRestore = useCallback(async (id: number) => {
    if (!isAdmin) {
      toast.error('无权限操作');
      return;
    }
    try {
      const res = await fetch(`/api/trash/${id}`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Restore failed');
      removeImage(id);
      toast.success('已恢复图片');
    } catch (err) {
      console.error('Error restoring image:', err);
      toast.error('恢复失败');
    }
  }, [isAdmin, removeImage]);

  // 永久删除单张图片
  const handlePermanentDelete = useCallback(async (id: number) => {
    if (!isAdmin) {
      toast.error('无权限操作');
      return;
    }
    try {
      const res = await fetch(`/api/trash/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      removeImage(id);
      toast.success('已永久删除');
    } catch (err) {
      console.error('Error deleting image:', err);
      toast.error('删除失败');
    }
  }, [isAdmin, removeImage]);

  // 批量恢复
  const handleBatchRestore = useCallback(async () => {
    if (!isAdmin || selectedImageIds.size === 0) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/trash/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedImageIds) }),
      });
      if (!res.ok) throw new Error('Batch restore failed');
      const data = await res.json();
      removeImages(selectedImageIds);
      clearSelection();
      setIsSelectionMode(false);
      toast.success(`已恢复 ${data.restoredCount} 张图片`);
    } catch (err) {
      console.error('Error batch restoring:', err);
      toast.error('批量恢复失败');
    } finally {
      setIsProcessing(false);
    }
  }, [isAdmin, selectedImageIds, removeImages, clearSelection, setIsSelectionMode]);

  // 批量永久删除
  const handleBatchDelete = useCallback(async () => {
    if (!isAdmin || selectedImageIds.size === 0) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/trash/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedImageIds) }),
      });
      if (!res.ok) throw new Error('Batch delete failed');
      const data = await res.json();
      removeImages(selectedImageIds);
      clearSelection();
      setIsSelectionMode(false);
      toast.success(`已永久删除 ${data.deletedCount} 张图片`);
    } catch (err) {
      console.error('Error batch deleting:', err);
      toast.error('批量删除失败');
    } finally {
      setIsProcessing(false);
    }
  }, [isAdmin, selectedImageIds, removeImages, clearSelection, setIsSelectionMode]);

  // 清空回收站
  const handleEmptyTrash = useCallback(async () => {
    if (!isAdmin) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/trash', { method: 'DELETE' });
      if (!res.ok) throw new Error('Empty trash failed');
      const data = await res.json();
      refetch();
      setShowEmptyConfirm(false);
      toast.success(`已清空回收站，永久删除 ${data.deletedCount} 张图片`);
    } catch (err) {
      console.error('Error emptying trash:', err);
      toast.error('清空失败');
    } finally {
      setIsProcessing(false);
    }
  }, [isAdmin, refetch]);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selectedImageIds.size === images.length) {
      clearSelection();
    } else {
      setSelectedIds(new Set(images.map(img => img.id)));
    }
  }, [images, selectedImageIds.size, clearSelection, setSelectedIds]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200">
      {/* 极光背景 - 红/橙色调 */}
      <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
        <div className="absolute top-0 left-0 w-[600px] h-[400px] bg-red-500/10 rounded-full blur-[100px] -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[200px] bg-orange-500/15 rounded-full blur-[120px] translate-x-1/3" />
      </div>

      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* 左侧：返回 + 标题 */}
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-400" />
                  回收站
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  {totalCount} 张图片
                </p>
              </div>
            </div>

            {/* 右侧：操作按钮 */}
            {isAdmin && totalCount > 0 && (
              <div className="flex items-center gap-3">
                {/* 全选按钮 */}
                <button
                  onClick={() => {
                    if (!isSelectionMode) {
                      setIsSelectionMode(true);
                    }
                    handleSelectAll();
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-sm font-medium transition-colors"
                >
                  {isSelectionMode && selectedImageIds.size === images.length
                    ? '取消全选'
                    : '全选'}
                </button>

                {/* 清空回收站按钮 */}
                <button
                  onClick={() => setShowEmptyConfirm(true)}
                  className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  清空回收站
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="relative z-[2] px-6 py-8 max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
        {/* 错误状态 */}
        {error && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-300 mb-2">加载失败</h2>
            <p className="text-sm text-gray-500 mb-6">{error}</p>
            <button
              onClick={refetch}
              className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              重试
            </button>
          </div>
        )}

        {/* 空状态 */}
        {!error && images.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
              <Trash2 className="w-10 h-10 text-gray-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-300 mb-2">回收站是空的</h2>
            <p className="text-sm text-gray-500 mb-6">
              被删除的图片会在这里显示
            </p>
            <Link
              href="/"
              className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              返回图库
            </Link>
          </div>
        )}

        {/* 图片网格 */}
        {!error && (images.length > 0 || isLoading) && (
          <TrashImageGrid
            images={images}
            isLoading={isLoading}
            hasMore={hasMore}
            loadMoreRef={loadMoreRef}
            isSelectionMode={isSelectionMode}
            selectedImageIds={selectedImageIds}
            onToggleSelection={toggleSelection}
            onRestore={handleRestore}
            onDelete={handlePermanentDelete}
            isAdmin={isAdmin}
          />
        )}
      </main>

      {/* 底部操作栏 */}
      <TrashActionBar
        isVisible={isSelectionMode && selectedImageIds.size > 0}
        selectedCount={selectedImageIds.size}
        isAdmin={isAdmin}
        isProcessing={isProcessing}
        onRestore={handleBatchRestore}
        onDelete={handleBatchDelete}
        onClose={() => {
          setIsSelectionMode(false);
          clearSelection();
        }}
      />

      {/* 清空确认弹窗 */}
      <EmptyTrashConfirmModal
        isOpen={showEmptyConfirm}
        totalCount={totalCount}
        isProcessing={isProcessing}
        onConfirm={handleEmptyTrash}
        onCancel={() => setShowEmptyConfirm(false)}
      />
    </div>
  );
}
