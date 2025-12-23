'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Grid, LayoutGrid, Maximize, Shuffle, Clock, Check, Upload, Lock, LogOut, Trash2, HelpCircle } from 'lucide-react';
import type { GridSize, SortMode } from '../types';
import { MODEL_BASES, STYLE_SOURCES } from '../lib/constants';
import type { StyleSource } from '../lib/constants';
import type { AvailableStyles } from '../hooks/useImages';

// 缩略图尺寸循环顺序
const GRID_SIZE_CYCLE: GridSize[] = ['small', 'medium', 'large'];
const GRID_SIZE_ICONS = {
  small: Grid,
  medium: LayoutGrid,
  large: Maximize,
};

interface SidebarProps {
  // Data
  totalAssets: number;

  // Search & Filter
  search: string;
  setSearch: (value: string) => void;
  likedOnly: boolean;
  setLikedOnly: (value: boolean) => void;

  // Model Base Filter (单选)
  selectedModelBase: string | null;
  selectModelBase: (modelBase: string | null) => void;

  // Style Filter (单选)
  selectedStyle: string | null;
  selectStyle: (style: string | null) => void;
  activeStyleTab: StyleSource;
  setActiveStyleTab: (tab: StyleSource) => void;
  availableStyles: AvailableStyles;

  // View
  gridSize: GridSize;
  setGridSize: (size: GridSize) => void;

  // Sort
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  shuffleImages: () => void;

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

  // 快捷键反馈回调注册
  onRegisterFeedback?: (callbacks: { grid: () => void; shuffle: () => void }) => void;

  // 帮助入口
  onHelpClick?: () => void;
}

export function Sidebar({
  totalAssets,
  search,
  setSearch,
  likedOnly,
  setLikedOnly,
  selectedModelBase,
  selectModelBase,
  selectedStyle,
  selectStyle,
  activeStyleTab,
  setActiveStyleTab,
  availableStyles,
  gridSize,
  setGridSize,
  sortMode,
  setSortMode,
  shuffleImages,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  onTitleClick,
  onUploadClick,
  isAdmin,
  onLogin,
  onLogout,
  onRegisterFeedback,
  onHelpClick,
}: SidebarProps) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 点击反馈状态
  const [gridClickFeedback, setGridClickFeedback] = useState(false);
  const [sortClickFeedback, setSortClickFeedback] = useState(false);

  // 使用 useMemo 优化 GridIcon 查找
  const GridIcon = useMemo(() => GRID_SIZE_ICONS[gridSize], [gridSize]);
  const isRandomMode = sortMode === 'random_shuffle' || sortMode === 'random_block';

  // 计算选中风格所属的大类
  const selectedStyleSource = useMemo(() => {
    if (!selectedStyle) return null;
    for (const source of STYLE_SOURCES) {
      if (availableStyles[source].includes(selectedStyle)) {
        return source;
      }
    }
    return null;
  }, [selectedStyle, availableStyles]);

  // 暴露视觉反馈方法供外部调用
  const triggerGridFeedback = () => {
    setGridClickFeedback(true);
    setTimeout(() => setGridClickFeedback(false), 150);
  };

  const triggerShuffleFeedback = () => {
    setSortClickFeedback(true);
    setTimeout(() => setSortClickFeedback(false), 150);
  };

  // 注册反馈回调
  useEffect(() => {
    onRegisterFeedback?.({ grid: triggerGridFeedback, shuffle: triggerShuffleFeedback });
  }, [onRegisterFeedback]);

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
  // 缩略图切换函数（带点击反馈）
  const cycleGridSize = () => {
    setGridClickFeedback(true);
    setTimeout(() => setGridClickFeedback(false), 150);
    const currentIndex = GRID_SIZE_CYCLE.indexOf(gridSize);
    const nextIndex = (currentIndex + 1) % GRID_SIZE_CYCLE.length;
    setGridSize(GRID_SIZE_CYCLE[nextIndex]);
  };

  // 排序切换函数（带点击反馈）
  const toggleSortMode = () => {
    setSortClickFeedback(true);
    setTimeout(() => setSortClickFeedback(false), 150);
    if (sortMode === 'date_desc') {
      setSortMode('random_shuffle');
      shuffleImages();
    } else {
      setSortMode('date_desc');
    }
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

        {/* Action Bar: Upload + Grid Size + Shuffle */}
        <div className="px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            {/* Upload Button */}
            <button
              onClick={onUploadClick}
              disabled={!isAdmin}
              data-onboarding="upload"
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isAdmin
                  ? 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white'
                  : 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Upload className="w-4 h-4" />
              上传
            </button>

            {/* Grid Size Toggle (Q) */}
            <button
              onClick={cycleGridSize}
              className={`p-2.5 rounded-xl border transition-all duration-150 ${
                gridClickFeedback
                  ? 'bg-orange-500/30 border-orange-500/50 text-orange-300 scale-95'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-400 hover:text-white'
              }`}
              title={`布局: ${gridSize} (Q)`}
            >
              <GridIcon className="w-4 h-4" />
            </button>

            {/* Sort Toggle Button (顺序/随机) */}
            <button
              onClick={toggleSortMode}
              className={`p-2.5 rounded-xl border transition-all duration-150 ${
                sortClickFeedback
                  ? 'bg-orange-500/30 border-orange-500/50 text-orange-300 scale-95'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-400 hover:text-white'
              }`}
              title={isRandomMode ? '随机排列 (点击切换为顺序)' : '顺序排列 (点击切换为随机)'}
            >
              {isRandomMode ? <Shuffle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
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

          {/* Model Base Filter - 网格布局，每行3个 */}
          <div className="space-y-2">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
              Model Base
              {selectedModelBase && <span className="ml-2 text-orange-400">· {selectedModelBase}</span>}
            </h2>
            <div className="grid grid-cols-3 gap-1.5 p-0.5 -m-0.5">
              {MODEL_BASES.map((base) => (
                <button
                  key={base}
                  onClick={() => selectModelBase(base)}
                  className={`py-2 px-1 rounded-lg text-[10px] font-medium transition-all duration-200 text-center truncate ${
                    selectedModelBase === base
                      ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/50'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                  }`}
                  title={base}
                >
                  {base}
                </button>
              ))}
            </div>
          </div>

          {/* Style Filter - 网格布局，每行2个 */}
          <div className="space-y-2" data-onboarding="style">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
              Style
              {selectedStyle && <span className="ml-2 text-orange-400">· {selectedStyle}</span>}
            </h2>
            {/* Tab 栏 */}
            <div className="flex gap-1 p-1 bg-black/30 rounded-lg">
              {STYLE_SOURCES.map((source) => {
                const isActive = activeStyleTab === source;
                const hasSelection = selectedStyleSource === source;
                return (
                  <button
                    key={source}
                    onClick={() => setActiveStyleTab(source)}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${
                      isActive
                        ? hasSelection
                          ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/50'
                          : 'bg-white/10 text-white'
                        : hasSelection
                          ? 'bg-orange-500/10 text-orange-400'
                          : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {source}
                    {availableStyles[source].length > 0 && (
                      <span className={`ml-1 text-[10px] ${hasSelection ? 'text-orange-400/70' : 'text-gray-500'}`}>
                        {availableStyles[source].length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* 网格布局 */}
            <div className="grid grid-cols-2 gap-1.5 max-h-[240px] overflow-y-auto custom-scrollbar p-0.5 -m-0.5">
              {availableStyles[activeStyleTab].length > 0 ? (
                availableStyles[activeStyleTab].map((style) => (
                  <button
                    key={style}
                    onClick={() => selectStyle(style)}
                    className={`py-2 px-2 rounded-lg text-[11px] font-medium transition-all duration-200 text-center truncate ${
                      selectedStyle === style
                        ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/50'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                    }`}
                    title={style}
                  >
                    {style}
                  </button>
                ))
              ) : (
                <p className="col-span-2 text-xs text-gray-600 italic py-4 text-center">
                  暂无 {activeStyleTab} 风格数据
                </p>
              )}
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
        </div>

        {/* Auth Section (Footer) - 两列布局 */}
        <div className="p-6 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-2">
            {/* 左列：登录/退出 */}
            <div className="flex-1">
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

            {/* 分隔线 */}
            <div className="w-px h-6 bg-white/10" />

            {/* 右列：回收站入口 */}
            <div className="flex-1">
              <Link
                href="/trash"
                className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                回收站
              </Link>
            </div>

            {/* 分隔线 */}
            <div className="w-px h-6 bg-white/10" />

            {/* 帮助入口 */}
            <button
              onClick={onHelpClick}
              className="p-2 text-gray-500 hover:text-gray-300 rounded-lg transition-colors hover:bg-white/5"
              title="帮助"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
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
                    : 'border-white/10 focus:border-orange-500 focus:ring-orange-500'
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
                  className="flex-1 bg-orange-500 hover:bg-orange-400 text-white py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
