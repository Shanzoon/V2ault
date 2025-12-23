'use client';

import { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { toast } from 'sonner';

import type { Image, GridSize } from './types';
import { useImages, useSelection, useKeyboardShortcuts, useUploadQueue, useAuth, useStyles, useBoxSelection, useBatchEdit } from './hooks';
import {
  ImageModal,
  ImageGrid,
  Sidebar,
  MobileHeader,
  UploadModal,
  UploadProgress,
  DatabaseErrorBanner,
  ScrollToTop,
  GlobalDropZone,
  SelectionBox,
  SelectionActionBar,
  KeyboardHelpModal,
  OnboardingGuide,
  resetOnboarding,
} from './components';

function HomeContent() {
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
    likedOnly,
    setLikedOnly,
    // Model Base Filter (单选)
    selectedModelBase,
    selectModelBase,
    // Style Filter (单选)
    selectedStyle,
    selectStyle,
    activeStyleTab,
    setActiveStyleTab,
    // Sort
    sortMode,
    setSortMode,
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

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);

  // Refs
  const scrollContainerRef = useRef<HTMLElement>(null);

  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 首次访问自动触发引导
  useEffect(() => {
    const completed = localStorage.getItem('v2ault_onboarding_completed');
    if (!completed) {
      const timer = setTimeout(() => setShowOnboarding(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Box Selection Hook (框选)
  const boxSelectionEnabled = !isUploadModalOpen && !selectedImage;
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
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    clearSelection();
  }, [setIsSelectionMode, clearSelection]);

  const { isProcessing: isBatchProcessing, batchLike, batchUpdateModel, batchUpdateStyle } = useBatchEdit({
    selectedImageIds,
    images,
    updateImages,
    onStyleChange: refetchStyles,
    onOperationComplete: exitSelectionMode,
  });

  // Scroll to top effect
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [debouncedSearch, sortMode]);

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

  const handleBatchDelete = useCallback(async () => {
    if (selectedImageIds.size === 0) return;

    const idsToDelete = Array.from(selectedImageIds);

    try {
      const res = await fetch('/api/images/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete }),
      });

      if (!res.ok) throw new Error('Delete failed');

      // 成功后从 UI 移除
      removeImages(selectedImageIds);
      clearSelection();
      setIsSelectionMode(false);
      toast.success(`已移至回收站 ${idsToDelete.length} 张图片`);
    } catch (error) {
      console.error('Error deleting images:', error);
      toast.error('删除失败');
    }
  }, [selectedImageIds, removeImages, clearSelection, setIsSelectionMode]);

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
  const handleCardDelete = useCallback(async (id: number) => {
    const imageToDelete = images.find(img => img.id === id);
    if (!imageToDelete) return;

    try {
      const res = await fetch(`/api/images/${id}`, { method: 'DELETE' });

      if (!res.ok) throw new Error('Delete failed');

      removeImage(id);
      toast.success('已移至回收站');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('删除失败');
    }
  }, [images, removeImage]);

  const handleSingleDelete = useCallback(async () => {
    if (!selectedImage) return;

    const targetId = selectedImage.id;

    // 计算下一张图片（用于 Modal 导航）
    let nextImage: Image | null = null;
    const currentIndex = images.findIndex(img => img.id === targetId);
    if (images.length > 1) {
      if (currentIndex < images.length - 1) {
        nextImage = images[currentIndex + 1];
      } else if (currentIndex > 0) {
        nextImage = images[currentIndex - 1];
      }
    }

    try {
      const res = await fetch(`/api/images/${targetId}`, { method: 'DELETE' });

      if (!res.ok) throw new Error('Delete failed');

      // 成功后从 UI 移除
      setSelectedImage(nextImage);
      removeImage(targetId);
      toast.success('已移至回收站');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('删除失败');
    }
  }, [selectedImage, images, removeImage]);

  // 快捷键反馈回调
  const [feedbackCallbacks, setFeedbackCallbacks] = useState<{ grid: () => void; shuffle: () => void } | null>(null);

  // 帮助入口处理
  const handleHelpClick = useCallback(() => {
    resetOnboarding();
    setShowOnboarding(true);
  }, []);

  // Keyboard Shortcuts
  const { isHelpOpen, setIsHelpOpen } = useKeyboardShortcuts({
    selectedImage,
    isFullscreen,
    isEditingPrompt: false,
    isSelectionMode,
    selectedImageIds,
    images,
    gridSize,
    activeStyleTab,
    availableStyles,
    selectedStyle,
    setGridSize,
    setIsFullscreen,
    setSelectedImage,
    setIsEditingPrompt: () => {},
    setIsSelectionMode,
    setActiveStyleTab,
    selectStyle,
    clearSelection,
    onBatchDelete: handleBatchDelete,
    onSingleDelete: handleSingleDelete,
    onTitleClick: handleTitleClick,
    onGridKeyPress: feedbackCallbacks?.grid,
    onShuffleKeyPress: feedbackCallbacks?.shuffle,
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
        likedOnly={likedOnly}
        setLikedOnly={setLikedOnly}
        // Model Base Filter (单选)
        selectedModelBase={selectedModelBase}
        selectModelBase={selectModelBase}
        // Style Filter (单选)
        selectedStyle={selectedStyle}
        selectStyle={selectStyle}
        activeStyleTab={activeStyleTab}
        setActiveStyleTab={setActiveStyleTab}
        availableStyles={availableStyles}
        // View
        gridSize={gridSize}
        setGridSize={setGridSize}
        // Sort
        sortMode={sortMode}
        setSortMode={setSortMode}
        shuffleImages={shuffleImages}
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
        onRegisterFeedback={setFeedbackCallbacks}
        onHelpClick={handleHelpClick}
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
              hasFilters={!!(search || selectedModelBase || selectedStyle || likedOnly)}
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

      {/* Keyboard Help Modal */}
      <KeyboardHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        hideBackdrop={showOnboarding}
      />

      {/* Onboarding Guide */}
      {showOnboarding && (
        <OnboardingGuide
          onComplete={() => {
            setShowOnboarding(false);
            setIsHelpOpen(false);
          }}
          onShowShortcuts={() => setIsHelpOpen(true)}
          isShortcutsOpen={isHelpOpen}
        />
      )}
    </div>
  );
}

// 加载骨架屏
function LoadingSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden text-gray-200 font-sans">
      <div className="flex-1 h-full overflow-y-auto p-4 md:p-10 lg:p-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="relative border border-orange-300/40 overflow-hidden animate-pulse aspect-square rounded-xl"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
