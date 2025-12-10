'use client';

import { useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import type { Image, GridSize, DeleteConfirmation } from './types';
import { useImages, useSelection, useKeyboardShortcuts } from './hooks';
import {
  ImageModal,
  ImageGrid,
  Sidebar,
  MobileHeader,
  DeleteConfirmModal,
} from './components';

export default function Home() {
  // Data & Filter Hooks
  const {
    images,
    totalAssets,
    isLoading,
    hasMore,
    loadMoreRef,
    search,
    setSearch,
    selectedResolutions,
    toggleResolution,
    sortMode,
    setSortMode,
    setRandomSeed,
    shuffleImages,
    updateImage,
    removeImage,
    removeImages,
  } = useImages();

  // Selection Hook
  const {
    isSelectionMode,
    setIsSelectionMode,
    selectedImageIds,
    toggleSelection,
    clearSelection,
  } = useSelection();

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

  // Refs
  const singleDeleteBtnRef = useRef<HTMLButtonElement>(null);
  const bulkDeleteBtnRef = useRef<HTMLButtonElement>(null);

  // Handlers
  const handleTitleClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    shuffleImages();
    setIsMobileMenuOpen(false);
  }, [shuffleImages]);

  const handleBulkDownload = useCallback(async () => {
    if (selectedImageIds.size === 0) return;

    try {
      setIsBulkDownloading(true);
      const zip = new JSZip();
      const folder = zip.folder('images');
      const selectedImages = images.filter(img => selectedImageIds.has(img.id));

      const promises = selectedImages.map(async (img) => {
        try {
          const response = await fetch(`/api/image/${img.id}`);
          const blob = await response.blob();
          folder?.file(img.filename, blob);
        } catch (err) {
          console.error(`Failed to download ${img.filename}`, err);
        }
      });

      await Promise.all(promises);
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'images.zip');
    } catch (error) {
      console.error('Error creating zip:', error);
      alert('Failed to download images');
    } finally {
      setIsBulkDownloading(false);
    }
  }, [selectedImageIds, images]);

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
        const res = await fetch(`/api/images/${selectedImage.id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete');
        removeImage(selectedImage.id);
        setSelectedImage(null);
      } catch (error) {
        console.error('Error deleting image:', error);
        alert('Failed to delete image');
      } finally {
        setIsDeleting(false);
        setDeleteConfirmation({ show: false, type: null });
      }
    }
  }, [deleteConfirmation.type, selectedImageIds, selectedImage, removeImages, removeImage, clearSelection]);

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
      />

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto relative bg-black p-4 md:p-10 lg:p-12 scrollbar-hide md:scrollbar-thin md:scrollbar-thumb-white/10 md:scrollbar-track-transparent pt-16 md:pt-10">
        <div className="max-w-[2000px] mx-auto min-h-full pb-20">
          <ImageGrid
            images={images}
            isLoading={isLoading}
            hasMore={hasMore}
            gridSize={gridSize}
            isSelectionMode={isSelectionMode}
            selectedImageIds={selectedImageIds}
            onToggleSelection={toggleSelection}
            onImageClick={setSelectedImage}
            loadMoreRef={loadMoreRef}
          />
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
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        deleteConfirmation={deleteConfirmation}
        setDeleteConfirmation={setDeleteConfirmation}
        selectedImageIds={selectedImageIds}
        onConfirm={executeDelete}
      />
    </div>
  );
}
