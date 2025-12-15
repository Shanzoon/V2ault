'use client';

import { useState, useCallback, useRef, useEffect } from 'react';


import type { Image, GridSize, DeleteConfirmation } from './types';
import { useImages, useSelection, useKeyboardShortcuts, useUploadQueue, useAuth } from './hooks';
import {
  ImageModal,
  ImageGrid,
  Sidebar,
  MobileHeader,
  DeleteConfirmModal,
  UploadModal,
  UploadProgress,
  DatabaseErrorBanner,
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

  // Upload Queue Hook
  const uploadQueue = useUploadQueue(refetch);

  // Auth Hook
  const { isAdmin, login, logout } = useAuth();

  // UI State
  const [gridSize, setGridSize] = useState<GridSize>('small');
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
    } else if (deleteConfirmation.type === 'single' && selectedImage) {
      try {
        setIsDeleting(true);
        const currentIndex = images.findIndex(img => img.id === selectedImage.id);
        const res = await fetch(`/api/images/${selectedImage.id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete');
        removeImage(selectedImage.id);

        // Navigate to next or previous image instead of closing
        if (images.length > 1) {
          if (currentIndex < images.length - 1) {
            // Go to next image
            setSelectedImage(images[currentIndex + 1]);
          } else if (currentIndex > 0) {
            // Go to previous image if at the end
            setSelectedImage(images[currentIndex - 1]);
          } else {
            setSelectedImage(null);
          }
        } else {
          setSelectedImage(null);
        }
      } catch (error) {
        console.error('Error deleting image:', error);
        alert('Failed to delete image');
      } finally {
        setIsDeleting(false);
        setDeleteConfirmation({ show: false, type: null });
      }
    }
  }, [deleteConfirmation.type, selectedImageIds, selectedImage, images, removeImages, removeImage, clearSelection]);

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    selectedImage,
    isFullscreen,
    isEditingPrompt: false,
    deleteConfirmation,
    isSelectionMode,
    selectedImageIds,
    images,
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
  });

  return (
    <div className="flex h-screen overflow-hidden bg-black text-gray-200 font-sans selection:bg-indigo-500/30">
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
        gridSize={gridSize}
        setGridSize={setGridSize}
        sortMode={sortMode}
        setSortMode={setSortMode}
        setRandomSeed={setRandomSeed}
        isSelectionMode={isSelectionMode}
        setIsSelectionMode={setIsSelectionMode}
        selectedImageIds={selectedImageIds}
        onBulkDownload={handleBulkDownload}
        onBatchDelete={handleBatchDelete}
        isBulkDownloading={isBulkDownloading}
        isDeleting={isDeleting}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onTitleClick={handleTitleClick}
        onUploadClick={() => setIsUploadModalOpen(true)}
        isAdmin={isAdmin}
        onLogin={login}
        onLogout={logout}
      />

      {/* Main Content */}
      <main
        ref={scrollContainerRef}
        className="flex-1 h-full overflow-y-auto relative bg-black p-4 md:p-10 lg:p-12 scrollbar-hide md:scrollbar-thin md:scrollbar-thumb-white/10 md:scrollbar-track-transparent pt-16 md:pt-10"
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
    </div>
  );
}
