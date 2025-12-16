'use client';

import { useState, useCallback, useRef, useEffect } from 'react';


import type { Image, GridSize, DeleteConfirmation } from './types';
import { useImages, useSelection, useKeyboardShortcuts, useUploadQueue, useAuth, useStyles } from './hooks';
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
    removeImage,
    removeImages,
    toggleLiked,
    refetch,
  } = useImages();

  // Selection Hook
  const {
    isSelectionMode,
    setIsSelectionMode,
    selectedImageIds,
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

  // UI State
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>({
    show: false,
    type: null,
    triggerRect: null,
  });

  // 单图删除的临时存储
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Refs
  const singleDeleteBtnRef = useRef<HTMLButtonElement>(null);
  const bulkDeleteBtnRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);

  // Scroll to top effect
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [debouncedSearch, sortMode, randomSeed]);

  // Sync selectedImage with images array (for like status updates)
  useEffect(() => {
    if (selectedImage) {
      const updatedImage = images.find(img => img.id === selectedImage.id);
      if (updatedImage && updatedImage.like_count !== selectedImage.like_count) {
        setSelectedImage(updatedImage);
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
      try {
        setIsDeleting(true);
        const res = await fetch('/api/images/batch', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedImageIds) }),
        });

        if (!res.ok) throw new Error('Failed to delete');
        removeImages(selectedImageIds);
        clearSelection();
      } catch (error) {
        console.error('Error deleting images:', error);
        alert('Failed to delete images');
      } finally {
        setIsDeleting(false);
        setDeleteConfirmation({ show: false, type: null });
      }
    } else if (deleteConfirmation.type === 'single') {
      // 优先使用 pendingDeleteId（从卡片菜单删除），否则使用 selectedImage（从 Modal 删除）
      const targetId = pendingDeleteId || selectedImage?.id;
      if (!targetId) return;

      // 先计算下一张图片，再删除
      let nextImage: Image | null = null;
      if (selectedImage && selectedImage.id === targetId) {
        const currentIndex = images.findIndex(img => img.id === targetId);
        if (images.length > 1) {
          if (currentIndex < images.length - 1) {
            nextImage = images[currentIndex + 1];
          } else if (currentIndex > 0) {
            nextImage = images[currentIndex - 1];
          }
        }
      }

      try {
        setIsDeleting(true);
        const res = await fetch(`/api/images/${targetId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete');

        // 先设置下一张图片，再从数组中移除
        if (selectedImage && selectedImage.id === targetId) {
          setSelectedImage(nextImage);
        }
        removeImage(targetId);
      } catch (error) {
        console.error('Error deleting image:', error);
        alert('Failed to delete image');
      } finally {
        setIsDeleting(false);
        setDeleteConfirmation({ show: false, type: null });
        setPendingDeleteId(null);
      }
    }
  }, [deleteConfirmation.type, selectedImageIds, selectedImage, pendingDeleteId, images, removeImages, removeImage, clearSelection]);

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
        // Selection
        isSelectionMode={isSelectionMode}
        setIsSelectionMode={setIsSelectionMode}
        selectedImageIds={selectedImageIds}
        onBulkDownload={handleBulkDownload}
        onBatchDelete={handleBatchDelete}
        isBulkDownloading={isBulkDownloading}
        isDeleting={isDeleting}
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
        className="flex-1 h-full overflow-y-auto relative z-[2] p-4 md:p-10 lg:p-12 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pt-16 md:pt-10"
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
        isDeleting={isDeleting}
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
    </div>
  );
}
