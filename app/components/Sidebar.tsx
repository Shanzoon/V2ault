'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Grid, LayoutGrid, Maximize, Shuffle, Clock, Check, Upload, Lock, LogOut, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
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
  selectedResolutions: string[];
  toggleResolution: (res: string) => void;
  likedOnly: boolean;
  setLikedOnly: (value: boolean) => void;

  // Model Base Filter
  selectedModelBases: string[];
  toggleModelBase: (modelBase: string) => void;

  // Style Filter
  selectedStyles: string[];
  toggleStyle: (style: string) => void;
  activeStyleTab: StyleSource;
  setActiveStyleTab: (tab: StyleSource) => void;
  availableStyles: AvailableStyles;

  // View
  gridSize: GridSize;
  setGridSize: (size: GridSize) => void;

  // Sort
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  setRandomSeed: (seed: number) => void;

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
  selectedModelBases,
  toggleModelBase,
  selectedStyles,
  toggleStyle,
  activeStyleTab,
  setActiveStyleTab,
  availableStyles,
  gridSize,
  setGridSize,
  sortMode,
  setSortMode,
  setRandomSeed,
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

  // 点击反馈状态
  const [gridClickFeedback, setGridClickFeedback] = useState(false);
  const [sortClickFeedback, setSortClickFeedback] = useState(false);

  // 折叠面板状态
  const [expandedSections, setExpandedSections] = useState({
    modelBase: true,
    style: true,
    resolution: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // 监听键盘快捷键，显示反馈
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入框中，不触发反馈
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key.toLowerCase() === 'q') {
        setGridClickFeedback(true);
        setTimeout(() => setGridClickFeedback(false), 150);
      }
      if (e.key.toLowerCase() === 'r') {
        setSortClickFeedback(true);
        setTimeout(() => setSortClickFeedback(false), 150);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      setRandomSeed(Math.floor(Math.random() * 1000000));
    } else {
      setSortMode('date_desc');
    }
  };

  const GridIcon = GRID_SIZE_ICONS[gridSize];
  const isRandomMode = sortMode === 'random_shuffle' || sortMode === 'random_block';

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

          {/* Style Filter - 移到搜索框下方 */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('style')}
              className="w-full flex items-center justify-between group"
            >
              <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-hover:text-gray-400 transition-colors">
                Style
                {selectedStyles.length > 0 && (
                  <span className="ml-2 text-orange-400">({selectedStyles.length})</span>
                )}
              </h2>
              {expandedSections.style ? (
                <ChevronUp className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              )}
            </button>
            <AnimatePresence>
              {expandedSections.style && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {/* Tab 栏 */}
                  <div className="flex gap-1 p-1 bg-black/30 rounded-lg mt-2">
                    {STYLE_SOURCES.map((source) => (
                      <button
                        key={source}
                        onClick={() => setActiveStyleTab(source)}
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${
                          activeStyleTab === source
                            ? 'bg-white/10 text-white'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {source}
                        {availableStyles[source].length > 0 && (
                          <span className="ml-1 text-gray-500">
                            {availableStyles[source].length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* 标签云 */}
                  <div className="flex flex-wrap gap-2 pt-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {availableStyles[activeStyleTab].length > 0 ? (
                      availableStyles[activeStyleTab].map((style) => (
                        <button
                          key={style}
                          onClick={() => toggleStyle(style)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                            selectedStyles.includes(style)
                              ? 'bg-orange-500/80 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300 border border-white/5'
                          }`}
                        >
                          {style}
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-gray-600 italic">暂无 {activeStyleTab} 风格数据</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Model Base Filter */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('modelBase')}
              className="w-full flex items-center justify-between group"
            >
              <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-hover:text-gray-400 transition-colors">
                Model Base
                {selectedModelBases.length > 0 && (
                  <span className="ml-2 text-orange-400">({selectedModelBases.length})</span>
                )}
              </h2>
              {expandedSections.modelBase ? (
                <ChevronUp className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              )}
            </button>
            <AnimatePresence>
              {expandedSections.modelBase && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2 pt-2">
                    {MODEL_BASES.map((base) => (
                      <button
                        key={base}
                        onClick={() => toggleModelBase(base)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          selectedModelBases.includes(base)
                            ? 'bg-orange-500/80 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300 border border-white/5'
                        }`}
                      >
                        {base}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Resolution Filter */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('resolution')}
              className="w-full flex items-center justify-between group"
            >
              <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-hover:text-gray-400 transition-colors">
                Resolution
                {selectedResolutions.length > 0 && (
                  <span className="ml-2 text-orange-400">({selectedResolutions.length})</span>
                )}
              </h2>
              {expandedSections.resolution ? (
                <ChevronUp className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              )}
            </button>
            <AnimatePresence>
              {expandedSections.resolution && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2 pt-2">
                    {['medium', 'high', 'ultra'].map((res) => (
                      <button
                        key={res}
                        onClick={() => toggleResolution(res)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all duration-200 ${
                          selectedResolutions.includes(res)
                            ? 'bg-white/15 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                            : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300 border border-white/5'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
