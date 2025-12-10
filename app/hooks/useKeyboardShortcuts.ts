'use client';

import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { Image, GridSize, DeleteConfirmation } from '../types';

interface UseKeyboardShortcutsOptions {
  selectedImage: Image | null;
  isFullscreen: boolean;
  isEditingPrompt: boolean;
  deleteConfirmation: DeleteConfirmation;
  isSelectionMode: boolean;
  selectedImageIds: Set<number>;
  images: Image[];
  setGridSize: (size: GridSize) => void;
  setIsFullscreen: (value: boolean) => void;
  setSelectedImage: (img: Image | null) => void;
  setIsEditingPrompt: (value: boolean) => void;
  setDeleteConfirmation: (value: DeleteConfirmation) => void;
  onBatchDelete: () => void;
  onSingleDelete: () => void;
  executeDelete: () => void;
}

export function useKeyboardShortcuts({
  selectedImage,
  isFullscreen,
  isEditingPrompt,
  deleteConfirmation,
  isSelectionMode,
  selectedImageIds,
  images,
  setGridSize,
  setIsFullscreen,
  setSelectedImage,
  setIsEditingPrompt,
  setDeleteConfirmation,
  onBatchDelete,
  onSingleDelete,
  executeDelete,
}: UseKeyboardShortcutsOptions) {
  const handleNextImage = useCallback(() => {
    if (!selectedImage) return;
    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    if (currentIndex !== -1 && currentIndex < images.length - 1) {
      setSelectedImage(images[currentIndex + 1]);
    }
  }, [selectedImage, images, setSelectedImage]);

  const handlePrevImage = useCallback(() => {
    if (!selectedImage) return;
    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    if (currentIndex > 0) {
      setSelectedImage(images[currentIndex - 1]);
    }
  }, [selectedImage, images, setSelectedImage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Grid Size Shortcuts (Q/W/E) - Only work when not editing text
      if (!isEditingPrompt && !selectedImage && !deleteConfirmation.show) {
        if (e.key.toLowerCase() === 'q') {
          setGridSize('small');
          toast('Small Grid View');
          return;
        }
        if (e.key.toLowerCase() === 'w') {
          setGridSize('medium');
          toast('Medium Grid View');
          return;
        }
        if (e.key.toLowerCase() === 'e') {
          setGridSize('large');
          toast('Large Grid View');
          return;
        }
      }

      if (e.key === 'Delete') {
        if (deleteConfirmation.show) return;
        if (isSelectionMode && selectedImageIds.size > 0) {
          onBatchDelete();
        } else if (selectedImage) {
          onSingleDelete();
        }
        return;
      }

      if (deleteConfirmation.show) {
        if (e.key === 'Escape') {
          setDeleteConfirmation({ show: false, type: null });
          e.stopPropagation();
        } else if (e.key === 'Enter') {
          executeDelete();
        }
        return;
      }

      if (!selectedImage) return;

      if (isEditingPrompt) {
        if (e.key === 'Escape') setIsEditingPrompt(false);
        return;
      }

      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          setSelectedImage(null);
        }
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedImage,
    isFullscreen,
    isEditingPrompt,
    deleteConfirmation.show,
    isSelectionMode,
    selectedImageIds,
    setGridSize,
    setIsFullscreen,
    setSelectedImage,
    setIsEditingPrompt,
    setDeleteConfirmation,
    onBatchDelete,
    onSingleDelete,
    executeDelete,
    handleNextImage,
    handlePrevImage,
  ]);

  return {
    handleNextImage,
    handlePrevImage,
  };
}
