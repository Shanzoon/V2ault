'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Grid, LayoutGrid, Maximize, Clock, Layers, Download, Trash2 } from 'lucide-react';
import type { GridSize, SortMode } from '../types';

interface SidebarProps {
  // Data
  totalAssets: number;

  // Search & Filter
  search: string;
  setSearch: (value: string) => void;
  selectedResolutions: string[];
  toggleResolution: (res: string) => void;

  // View
  gridSize: GridSize;
  setGridSize: (size: GridSize) => void;

  // Sort
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  setRandomSeed: (seed: number) => void;

  // Selection
  isSelectionMode: boolean;
  setIsSelectionMode: (value: boolean) => void;
  selectedImageIds: Set<number>;

  // Actions
  onBulkDownload: () => void;
  onBatchDelete: () => void;
  isBulkDownloading: boolean;
  isDeleting: boolean;

  // Mobile
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (value: boolean) => void;
  onTitleClick: () => void;
}

export function Sidebar({
  totalAssets,
  search,
  setSearch,
  selectedResolutions,
  toggleResolution,
  gridSize,
  setGridSize,
  sortMode,
  setSortMode,
  setRandomSeed,
  isSelectionMode,
  setIsSelectionMode,
  selectedImageIds,
  onBulkDownload,
  onBatchDelete,
  isBulkDownloading,
  isDeleting,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  onTitleClick,
}: SidebarProps) {
  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-80 h-full flex flex-col bg-black/95 backdrop-blur-2xl transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:bg-black/30 md:flex md:z-auto
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        {/* App Title */}
        <div className="p-6 pb-4">
          <h1
            onClick={onTitleClick}
            className="text-3xl font-black cursor-pointer hover:opacity-80 transition-opacity tracking-tight"
          >
            <span className="text-blue-600">V</span>
            <span className="text-gray-500">2ault</span>
          </h1>
          <p className="text-[10px] font-bold tracking-[0.2em] text-gray-500 mt-2">
            <span className="text-gray-300">{totalAssets.toLocaleString()}</span> ASSETS INDEXED
          </p>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-6 scrollbar-hide">
          {/* Search Module */}
          <div className="space-y-2">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-cyan-400 transition-colors" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-8 py-2.5 bg-white/5 border-none rounded-xl text-sm text-gray-200 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                placeholder="Search prompts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search.length > 0 && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* View & Sort Options (Compact) */}
          <div className="flex items-center gap-2">
            {/* View Options (3 buttons) */}
            <div className="flex-1 grid grid-cols-3 gap-1 p-1 bg-white/5 rounded-xl">
              <button
                onClick={() => setGridSize('small')}
                className={`flex items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                  gridSize === 'small'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
                title="Small Grid"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGridSize('medium')}
                className={`flex items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                  gridSize === 'medium'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
                title="Medium Grid"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGridSize('large')}
                className={`flex items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                  gridSize === 'large'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
                title="Large Grid"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>

            {/* Sort Order (2 buttons) */}
            <div className="flex-[0.6] grid grid-cols-2 gap-1 p-1 bg-white/5 rounded-xl">
              <button
                onClick={() => setSortMode('newest')}
                className={`flex items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                  sortMode === 'newest'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
                title="Newest First"
              >
                <Clock className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setSortMode('random_block');
                  setRandomSeed(Math.floor(Math.random() * 1000));
                }}
                className={`flex items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                  sortMode === 'random_block'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
                title="Random Batch"
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Resolution Filter */}
          <div className="space-y-2">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Resolution</h2>
            <div className="flex flex-col gap-2">
              {['low', 'medium', 'high', 'ultra'].map((res) => (
                <button
                  key={res}
                  onClick={() => toggleResolution(res)}
                  className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all duration-300 text-left border ${
                    selectedResolutions.includes(res)
                      ? 'bg-white/10 border-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                      : 'border-transparent bg-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selection Actions (Footer) */}
        <div className="p-6 border-t border-white/10 space-y-4 bg-black/20">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Selection Mode</h2>
            <button
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-black ${
                isSelectionMode ? 'bg-cyan-600' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  isSelectionMode ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <AnimatePresence>
            {isSelectionMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-4 text-xs font-medium text-gray-400">
                    <span className="uppercase tracking-wider">Selected</span>
                    <span className="font-mono text-white bg-white/10 px-2 py-0.5 rounded text-[10px]">
                      {selectedImageIds.size}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={onBulkDownload}
                      disabled={isBulkDownloading || selectedImageIds.size === 0}
                      className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                    >
                      {isBulkDownloading ? (
                        <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Download
                    </button>
                    <button
                      onClick={onBatchDelete}
                      disabled={isDeleting || selectedImageIds.size === 0}
                      className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>
    </>
  );
}
