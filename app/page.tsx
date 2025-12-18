'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

import type { Image, GridSize, DeleteConfirmation } from './types';
import { useImages, useSelection, useKeyboardShortcuts, useUploadQueue, useAuth, useStyles, useBoxSelection, useBatchEdit } from './hooks';
import {
  ImageModal,
  ImageGrid,
  Sidebar,
  MobileHeader,
  DeleteConfirmModal,
  UploadModal,
  UploadProgress,
  DatabaseErrorBanner,
  ScrollToTop,
  GlobalDropZone,
  SelectionBox,
  SelectionActionBar,
} from './components';

export default function Home() {
  // Data & Filter Hooks
  const {
    images,
    totalAssets,
    isLoading,
    hasMore,
    loadMoreRef,
    error,
    search,
    debouncedSearch,
    setSearch,
    selectedResolutions,
    toggleResolution,
    likedOnly,
    setLikedOnly,
    // Model Base Filter
    selectedModelBases,
    toggleModelBase,
    // Style Filter
    selectedStyles,
    toggleStyle,
    activeStyleTab,
    setActiveStyleTab,
    // Sort
    sortMode,
    setSortMode,
    randomSeed,
    setRandomSeed,
    shuffleImages,
    updateImage,
    updateImages,
    removeImage,
    removeImages,
    restoreImage,
    restoreImages,
    toggleLiked,
    refetch,
  } = useImages();

  // Selection Hook
  const {
    isSelectionMode,
    setIsSelectionMode,
    selectedImageIds,
    setSelectedIds,
    toggleSelection,
    clearSelection,
  } = useSelection();

  // Styles Hook (全局风格列表)
  const { availableStyles, refetchStyles } = useStyles();

  // Upload Queue Hook (上传完成后同时刷新图片和风格列表)
  const uploadQueue = useUploadQueue(useCallback(() => {
    refetch();
    refetchStyles();
  }, [refetch, refetchStyles]));

  // Auth Hook
  const { isAdmin, login, logout } = useAuth();

  // Card Rects State (用于框选碰撞检测)
  const [cardRects, setCardRects] = useState<Map<number, DOMRect>>(new Map());

  // UI State
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>({
    show: false,
    type: null,
    triggerRect: null,
  });

  // 单图删除的临时存储
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // 延迟删除的 timeout ref（用于撤销）
  const deleteTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);

  // Refs
  const singleDeleteBtnRef = useRef<HTMLButtonElement>(null);
  const bulkDeleteBtnRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);

  // Box Selection Hook (框选)
  const boxSelectionEnabled = !isUploadModalOpen && !selectedImage && !deleteConfirmation.show;
  const { selectionBox, isSelecting } = useBoxSelection({
    enabled: boxSelectionEnabled,
    scrollContainerRef,
    cardRects,
    onSelectionChange: setSelectedIds,
    setIsSelectionMode,
    isSelectionMode,
    hasSelection: selectedImageIds.size > 0,
    clearSelection,
  });

  // Batch Edit Hook (批量编辑)
  const { isProcessing: isBatchProcessing, batchLike, batchUpdateModel, batchUpdateStyle } = useBatchEdit({
    selectedImageIds,
    images,
    updateImages,
    onStyleChange: refetchStyles,
  });

  // Scroll to top effect
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [debouncedSearch, sortMode, randomSeed]);

  // Sync selectedImage with images array (for all field updates)
  useEffect(() => {
    if (selectedImage) {
      const updatedImage = images.find(img => img.id === selectedImage.id);
      if (updatedImage && updatedImage !== selectedImage) {
        // Check if any field has changed
        const hasChanges =
          updatedImage.like_count !== selectedImage.like_count ||
          updatedImage.model_base !== selectedImage.model_base ||
          updatedImage.source !== selectedImage.source ||
          updatedImage.style !== selectedImage.style ||
          updatedImage.style_ref !== selectedImage.style_ref ||
          updatedImage.prompt !== selectedImage.prompt;

        if (hasChanges) {
          setSelectedImage(updatedImage);
        }
      }
    }
  }, [images, selectedImage]);

  // Handlers
  const handleTitleClick = useCallback(() => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    shuffleImages();
    setIsMobileMenuOpen(false);
  }, [shuffleImages]);

  // 全局拖放处理
  const handleGlobalFilesDropped = useCallback((files: File[]) => {
    if (!isAdmin) {
      toast.error('无上传权限', { description: '请先登录管理员账号' });
      return;
    }
    setPendingFiles(files);
    if (!isUploadModalOpen) {
      setIsUploadModalOpen(true);
    }
  }, [isUploadModalOpen, isAdmin]);

  const handleFilesConsumed = useCallback(() => {
    setPendingFiles(null);
  }, []);

  const handleBulkDownload = useCallback(async () => {
    if (selectedImageIds.size === 0) return;

    try {
      setIsBulkDownloading(true);
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const zip = new JSZip();
      const folder = zip.folder('images');
      const selectedImages = images.filter(img => selectedImageIds.has(img.id));

      const promises = selectedImages.map(async (img) => {
        try {
          const response = await fetch(`/api/image/${img.id}`);
          const blob = await response.blob();
          folder?.file(img.filename, blob);
        } catch (err) {
          console.error(`Failed to download ${img.filename}:`, err);
        }
      });

      await Promise.all(promises);
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'v2ault-selection.zip');
    } catch (error) {
      console.error('Error creating zip:', error);
      alert('Failed to create download package');
    } finally {
      setIsBulkDownloading(false);
      clearSelection();
      setIsSelectionMode(false);
    }
  }, [selectedImageIds, images, clearSelection, setIsSelectionMode]);

  const handleBatchDelete = useCallback((e?: React.MouseEvent) => {
    if (selectedImageIds.size === 0) return;
    const rect = e?.currentTarget.getBoundingClientRect() || bulkDeleteBtnRef.current?.getBoundingClientRect();
    setDeleteConfirmation({ show: true, type: 'batch', triggerRect: rect });
  }, [selectedImageIds.size]);

  // 单图下载
  const handleSingleDownload = useCallback(async (id: number, filename: string) => {
    try {
      const response = await fetch(`/api/image/${id}`);
      const blob = await response.blob();
      const { saveAs } = await import('file-saver');
      saveAs(blob, filename);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image');
    }
  }, []);

  // 从卡片菜单删除单图
  const handleCardDelete = useCallback((id: number, e: React.MouseEvent) => {
    setPendingDeleteId(id);
    const rect = e.currentTarget.getBoundingClientRect();
    setDeleteConfirmation({ show: true, type: 'single', triggerRect: rect });
  }, []);

  const handleSingleDelete = useCallback((e?: React.MouseEvent) => {
    if (!selectedImage) return;
    const rect = e?.currentTarget.getBoundingClientRect() || singleDeleteBtnRef.current?.getBoundingClientRect();
    setDeleteConfirmation({ show: true, type: 'single', triggerRect: rect });
  }, [selectedImage]);

  const executeDelete = useCallback(async () => {
    if (deleteConfirmation.type === 'batch') {
      // 批量删除 - 支持撤销
      const idsToDelete = Array.from(selectedImageIds);
      const imagesToDelete = images.filter(img => selectedImageIds.has(img.id));

      if (imagesToDelete.length === 0) {
        setDeleteConfirmation({ show: false, type: null });
        return;
      }

      // 先从 UI 移除（乐观更新）
      removeImages(selectedImageIds);
      clearSelection();
      setDeleteConfirmation({ show: false, type: null });

      const deleteKey = `batch-${Date.now()}`;

      // 显示带撤销按钮的 toast
      toast(`已删除 ${imagesToDelete.length} 张图片`, {
        action: {
          label: '撤销',
          onClick: () => {
            // 清除延迟删除的 timeout
            if (deleteTimeoutRef.current[deleteKey]) {
              clearTimeout(deleteTimeoutRef.current[deleteKey]);
              delete deleteTimeoutRef.current[deleteKey];
            }
            // 恢复图片
            restoreImages(imagesToDelete);
            toast.success(`已恢复 ${imagesToDelete.length} 张图片`);
          },
        },
        duration: 3000,
        onDismiss: () => {
          // toast 消失时检查是否已被撤销
          if (!deleteTimeoutRef.current[deleteKey]) return;

          // 真正执行 API 删除
          fetch('/api/images/batch', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: idsToDelete }),
          }).catch(error => {
            console.error('Error deleting images:', error);
            // 删除失败，恢复图片
            restoreImages(imagesToDelete);
            toast.error('删除失败，已恢复图片');
          });

          delete deleteTimeoutRef.current[deleteKey];
        },
      });

      // 设置一个 marker，表示删除操作未被撤销
      deleteTimeoutRef.current[deleteKey] = setTimeout(() => {}, 0);

    } else if (deleteConfirmation.type === 'single') {
      // 单图删除 - 支持撤销
      const targetId = pendingDeleteId || selectedImage?.id;
      if (!targetId) return;

      const imageToDelete = images.find(img => img.id === targetId);
      if (!imageToDelete) {
        setDeleteConfirmation({ show: false, type: null });
        setPendingDeleteId(null);
        return;
      }

      // 计算下一张图片（用于 Modal 导航）
      let nextImage: Image | null = null;
      let neighborId: number | undefined;
      if (selectedImage && selectedImage.id === targetId) {
        const currentIndex = images.findIndex(img => img.id === targetId);
        if (images.length > 1) {
          if (currentIndex < images.length - 1) {
            nextImage = images[currentIndex + 1];
            neighborId = nextImage.id;
          } else if (currentIndex > 0) {
            nextImage = images[currentIndex - 1];
            neighborId = nextImage.id;
          }
        }
      } else {
        // 从卡片删除时，找相邻图片
        const currentIndex = images.findIndex(img => img.id === targetId);
        if (currentIndex < images.length - 1) {
          neighborId = images[currentIndex + 1].id;
        } else if (currentIndex > 0) {
          neighborId = images[currentIndex - 1].id;
        }
      }

      // 先从 UI 移除（乐观更新）
      if (selectedImage && selectedImage.id === targetId) {
        setSelectedImage(nextImage);
      }
      removeImage(targetId);
      setDeleteConfirmation({ show: false, type: null });
      setPendingDeleteId(null);

      const deleteKey = `single-${targetId}`;

      // 显示带撤销按钮的 toast
      toast('已删除图片', {
        description: imageToDelete.filename,
        action: {
          label: '撤销',
          onClick: () => {
            // 清除延迟删除的 timeout
            if (deleteTimeoutRef.current[deleteKey]) {
              clearTimeout(deleteTimeoutRef.current[deleteKey]);
              delete deleteTimeoutRef.current[deleteKey];
            }
            // 恢复图片到原位置附近
            restoreImage(imageToDelete, neighborId);
            toast.success('已恢复图片');
          },
        },
        duration: 3000,
        onDismiss: () => {
          // toast 消失时检查是否已被撤销
          if (!deleteTimeoutRef.current[deleteKey]) return;

          // 真正执行 API 删除
          fetch(`/api/images/${targetId}`, {
            method: 'DELETE',
          }).catch(error => {
            console.error('Error deleting image:', error);
            // 删除失败，恢复图片
            restoreImage(imageToDelete, neighborId);
            toast.error('删除失败，已恢复图片');
          });

          delete deleteTimeoutRef.current[deleteKey];
        },
      });

      // 设置一个 marker，表示删除操作未被撤销
      deleteTimeoutRef.current[deleteKey] = setTimeout(() => {}, 0);
    }
  }, [deleteConfirmation.type, selectedImageIds, selectedImage, pendingDeleteId, images, removeImages, removeImage, restoreImage, restoreImages, clearSelection]);

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    selectedImage,
    isFullscreen,
    isEditingPrompt: false,
    deleteConfirmation,
    isSelectionMode,
    selectedImageIds,
    images,
    gridSize,
    setGridSize,
    setIsFullscreen,
    setSelectedImage,
    setIsEditingPrompt: () => {},
    setDeleteConfirmation,
    setIsSelectionMode,
    clearSelection,
    onBatchDelete: handleBatchDelete,
    onSingleDelete: handleSingleDelete,
    executeDelete,
    onTitleClick: handleTitleClick,
  });

  return (
    <div className="flex h-screen overflow-hidden text-gray-200 font-sans selection:bg-indigo-500/30 relative">
      {/* Aurora Background */}
      <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
        <div className="absolute top-0 left-0 w-[600px] h-[400px] bg-orange-500/18 rounded-full blur-[100px] -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[1200px] h-[200px] bg-cyan-500/25 rounded-full blur-[120px] translate-x-1/3 translate-y-1/2 pointer-events-none" />
      </div>

      {/* Global Drop Zone */}
      <GlobalDropZone
        isUploadModalOpen={isUploadModalOpen}
        hasImageModal={selectedImage !== null}
        onFilesDropped={handleGlobalFilesDropped}
      />

      {/* Mobile Header */}
      <MobileHeader
        totalAssets={totalAssets}
        onMenuClick={() => setIsMobileMenuOpen(true)}
        onTitleClick={handleTitleClick}
      />

      {/* Sidebar */}
      <Sidebar
        totalAssets={totalAssets}
        search={search}
        setSearch={setSearch}
        selectedResolutions={selectedResolutions}
        toggleResolution={toggleResolution}
        likedOnly={likedOnly}
        setLikedOnly={setLikedOnly}
        // Model Base Filter
        selectedModelBases={selectedModelBases}
        toggleModelBase={toggleModelBase}
        // Style Filter
        selectedStyles={selectedStyles}
        toggleStyle={toggleStyle}
        activeStyleTab={activeStyleTab}
        setActiveStyleTab={setActiveStyleTab}
        availableStyles={availableStyles}
        // View
        gridSize={gridSize}
        setGridSize={setGridSize}
        // Sort
        sortMode={sortMode}
        setSortMode={setSortMode}
        setRandomSeed={setRandomSeed}
        // Mobile
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onTitleClick={handleTitleClick}
        // Upload
        onUploadClick={() => setIsUploadModalOpen(true)}
        // Auth
        isAdmin={isAdmin}
        onLogin={login}
        onLogout={logout}
      />

      {/* Main Content */}
      <main
        ref={scrollContainerRef}
        className="flex-1 h-full overflow-y-auto relative z-[2] p-4 md:p-10 lg:p-12 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pt-16 md:pt-10 select-none"
      >
        <div className="max-w-[2000px] mx-auto min-h-full pb-20">
          {/* Error State */}
          {error ? (
            <DatabaseErrorBanner error={error} onRetry={refetch} />
          ) : (
            <ImageGrid
              images={images}
              isLoading={isLoading}
              hasMore={hasMore}
              gridSize={gridSize}
              isSelectionMode={isSelectionMode}
              selectedImageIds={selectedImageIds}
              onToggleSelection={toggleSelection}
              onImageClick={setSelectedImage}
              onToggleLiked={toggleLiked}
              onDownload={handleSingleDownload}
              onDelete={handleCardDelete}
              isAdmin={isAdmin}
              loadMoreRef={loadMoreRef}
              onCardRectsChange={setCardRects}
            />
          )}
        </div>
      </main>

      {/* Image Modal */}
      <ImageModal
        selectedImage={selectedImage}
        images={images}
        isFullscreen={isFullscreen}
        setIsFullscreen={setIsFullscreen}
        setSelectedImage={setSelectedImage}
        onDelete={handleSingleDelete}
        onUpdateImage={updateImage}
        onToggleLiked={toggleLiked}
        isAdmin={isAdmin}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        deleteConfirmation={deleteConfirmation}
        setDeleteConfirmation={setDeleteConfirmation}
        selectedImageIds={selectedImageIds}
        onConfirm={executeDelete}
      />

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onStartUpload={(tasks) => {
          uploadQueue.addTasks(tasks);
        }}
        initialFiles={pendingFiles}
        onFilesConsumed={handleFilesConsumed}
      />

      {/* Upload Progress */}
      <UploadProgress
        state={uploadQueue.state}
        isMinimized={uploadQueue.isMinimized}
        isVisible={uploadQueue.isVisible}
        onToggleMinimize={() => uploadQueue.setIsMinimized(!uploadQueue.isMinimized)}
        onCancel={uploadQueue.cancelUpload}
        onClear={uploadQueue.clearQueue}
      />

      {/* Scroll To Top Button */}
      <ScrollToTop scrollContainerRef={scrollContainerRef} />

      {/* Selection Box (框选矩形) */}
      <SelectionBox
        selectionBox={selectionBox}
        scrollContainerRef={scrollContainerRef}
      />

      {/* Selection Action Bar (底部操作栏) - 框选过程中不显示 */}
      <SelectionActionBar
        isVisible={isSelectionMode && selectedImageIds.size > 0 && !isSelecting}
        selectedCount={selectedImageIds.size}
        isAdmin={isAdmin}
        isProcessing={isBatchProcessing || isBulkDownloading}
        onDownload={handleBulkDownload}
        onBatchLike={batchLike}
        onBatchDelete={handleBatchDelete}
        onBatchUpdateModel={batchUpdateModel}
        onBatchUpdateStyle={batchUpdateStyle}
        onClose={() => {
          setIsSelectionMode(false);
          clearSelection();
        }}
        availableStyles={availableStyles}
      />
    </div>
  );
}
