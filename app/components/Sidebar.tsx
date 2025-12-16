'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Grid, LayoutGrid, Maximize, Clock, Layers, Download, Trash2, Check, Upload, Lock, LogOut } from 'lucide-react';
import type { GridSize, SortMode } from '../types';

interface SidebarProps {
  // Data
  totalAssets: number;

  // Search & Filter
  search: string;
  setSearch: (value: string) => void;
  selectedResolutions: string[];
  toggleResolution: (res: string) => void;
  likedOnly: boolean;
  setLikedOnly: (value: boolean) => void;

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

  // Upload
  onUploadClick: () => void;

  // Auth
  isAdmin: boolean;
  onLogin: (password: string) => Promise<boolean>;
  onLogout: () => Promise<void>;
}

export function Sidebar({
  totalAssets,
  search,
  setSearch,
  selectedResolutions,
  toggleResolution,
  likedOnly,
  setLikedOnly,
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
  onUploadClick,
  isAdmin,
  onLogin,
  onLogout,
}: SidebarProps) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (!password.trim()) return;
    setIsLoggingIn(true);
    setLoginError(false);
    const success = await onLogin(password);
    setIsLoggingIn(false);
    if (success) {
      setShowLoginModal(false);
      setPassword('');
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = async () => {
    await onLogout();
  };
  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Content */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-full w-[280px] bg-transparent border-r border-white/5 flex flex-col z-50 transition-transform duration-300 ease-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <h1
            onClick={onTitleClick}
            className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 cursor-pointer hover:opacity-80 transition-opacity"
          >
            V2ault
          </h1>
          <p className="text-xs font-medium text-gray-500 mt-2 uppercase tracking-widest">
            {totalAssets} Assets
          </p>
        </div>

        {/* Upload Button */}
        <div className="px-6 py-4 border-b border-white/5">
          <button
            onClick={onUploadClick}
            disabled={!isAdmin}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${
              isAdmin
                ? 'bg-black/60 backdrop-blur-xl border border-white/10 hover:bg-white/10 text-white shadow-lg'
                : 'bg-gray-700/50 text-gray-500 cursor-not-allowed shadow-none'
            }`}
          >
            <Upload className="w-4 h-4" />
            上传图片
          </button>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Search */}
          <div className="relative group">
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all group-hover:border-white/20"
            />
            <Search className="absolute left-3.5 top-3.5 text-gray-600 w-4 h-4 group-hover:text-gray-400 transition-colors" />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-3.5 text-gray-600 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Layout</h2>
            </div>
            <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5">
              <button
                onClick={() => setGridSize('small')}
                className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                  gridSize === 'small'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGridSize('medium')}
                className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                  gridSize === 'medium'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGridSize('large')}
                className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                  gridSize === 'large'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sort Options */}
          <div className="space-y-2">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Sort</h2>
            <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5">
              <button
                onClick={() => setSortMode('date_desc')}
                className={`flex items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                  sortMode === 'date_desc'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
                title="Latest"
              >
                <Clock className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setSortMode('random_block');
                  setRandomSeed(Math.floor(Math.random() * 1000000));
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

          {/* Liked Filter */}
          <div className="space-y-2">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Filter</h2>
             <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-xl border border-transparent hover:bg-white/5 transition-all">
               <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-300 ${
                 likedOnly 
                   ? 'bg-red-500 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' 
                   : 'border-white/20 bg-white/5 group-hover:border-white/40'
               }`}>
                 {likedOnly && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
               </div>
               <span className={`text-xs font-bold tracking-wide uppercase transition-colors ${
                 likedOnly ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
               }`}>
                 Liked
               </span>
               <input 
                 type="checkbox" 
                 className="hidden" 
                 checked={likedOnly} 
                 onChange={(e) => setLikedOnly(e.target.checked)} 
               />
             </label>
          </div>

          {/* Resolution Filter */}
          <div className="space-y-2">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Resolution</h2>
            <div className="flex flex-col gap-2">
              {['medium', 'high', 'ultra'].map((res) => (
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
        <div className="p-6 border-t border-white/10 bg-black/20 flex flex-col-reverse gap-4">
          {/* Toggle Switch - Always at bottom */}
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

          {/* Action Panel - Appears above the toggle */}
          <AnimatePresence>
            {isSelectionMode && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
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
                      disabled={!isAdmin || isDeleting || selectedImageIds.size === 0}
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

          {/* Auth Button */}
          <div className="pt-4 border-t border-white/5">
            {isAdmin ? (
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
              >
                <LogOut className="w-3.5 h-3.5" />
                退出管理
              </button>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
              >
                <Lock className="w-3.5 h-3.5" />
                管理员登录
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center"
            onClick={() => {
              setShowLoginModal(false);
              setPassword('');
              setLoginError(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a1a] rounded-xl border border-white/10 p-6 w-[320px] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-4">管理员登录</h3>
              <input
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLogin();
                }}
                className={`w-full bg-black/40 border rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 transition-all ${
                  loginError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-white/10 focus:border-cyan-500 focus:ring-cyan-500'
                }`}
                autoFocus
              />
              {loginError && (
                <p className="text-red-400 text-xs mt-2">密码错误</p>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    setPassword('');
                    setLoginError(false);
                  }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn || !password.trim()}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoggingIn ? '登录中...' : '登录'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
