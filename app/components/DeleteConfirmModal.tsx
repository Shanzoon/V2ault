'use client';

import { useRef, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { DeleteConfirmation } from '../types';

interface DeleteConfirmModalProps {
  deleteConfirmation: DeleteConfirmation;
  setDeleteConfirmation: (value: DeleteConfirmation) => void;
  selectedImageIds: Set<number>;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  deleteConfirmation,
  setDeleteConfirmation,
  selectedImageIds,
  onConfirm,
}: DeleteConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deleteConfirmation.show && modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setDeleteConfirmation({ show: false, type: null });
      }
    };

    if (deleteConfirmation.show) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [deleteConfirmation.show, setDeleteConfirmation]);

  if (!deleteConfirmation.show) return null;

  const getModalStyle = () => {
    if (!deleteConfirmation.triggerRect) {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
      };
    }
    const rect = deleteConfirmation.triggerRect;
    return {
      position: 'fixed' as const,
      bottom: `${window.innerHeight - rect.top + 12}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: 'translateX(-50%)',
      zIndex: 100,
    };
  };

  return (
    <div
      ref={modalRef}
      style={getModalStyle()}
      className="fixed z-[100] w-72 bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-2xl animate-in zoom-in-95 duration-100 origin-top"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-red-900/20 rounded-full shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">Confirm Deletion</h3>
          <p className="text-gray-400 text-xs mt-1">
            Are you sure you want to delete{' '}
            {deleteConfirmation.type === 'batch' ? `${selectedImageIds.size} images` : 'this image'}? This action
            cannot be undone.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setDeleteConfirmation({ show: false, type: null })}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium text-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-colors shadow-lg shadow-red-900/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
