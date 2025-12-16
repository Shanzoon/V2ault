'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Heart, Download, Trash2 } from 'lucide-react';
import { decode } from 'blurhash';
import type { ImageCardProps } from '../types';

const BlurhashCanvas = ({ hash }: { hash: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hash) return;

    try {
      const pixels = decode(hash, 32, 32);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.createImageData(32, 32);
        imageData.data.set(pixels);
        ctx.putImageData(imageData, 0, 0);
      }
    } catch (e) {
      console.error('Blurhash decode error:', e);
    }
  }, [hash]);

  return <canvas ref={canvasRef} width={32} height={32} className="w-full h-full" />;
};

export const ImageCard = memo(function ImageCard({
  img,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  onImageClick,
  onToggleLiked,
  onDownload,
  onDelete,
  isAdmin,
  loadHighRes,
}: ImageCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const ratio = (img.width && img.height) ? (img.width / img.height) : 1;
  let spanClass = 'col-span-1 row-span-1';
  let aspectClass = 'aspect-square';

  if (ratio > 1.2) {
    spanClass = 'col-span-2 row-span-1';
    aspectClass = 'aspect-[2/1]';
  } else if (ratio < 0.8) {
    spanClass = 'col-span-1 row-span-2';
    aspectClass = 'aspect-[1/2]';
  }

  // Progressive Loading URLs
  const tinyUrl = `/api/image/${img.id}?w=50`;
  const smallUrl = `/api/image/${img.id}?w=600`;
  const largeUrl = `/api/image/${img.id}?w=1600`;

  const [smallLoaded, setSmallLoaded] = useState(false);
  const [largeLoaded, setLargeLoaded] = useState(false);

  const isLiked = img.like_count ? img.like_count > 0 : false;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{
        layout: { duration: 0.25, ease: "easeOut" },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 }
      }}
      className={`relative group bg-gray-900 overflow-hidden ${spanClass} ${
        isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-black' : ''
      }`}
      onClick={() => {
        if (isSelectionMode) {
          onToggleSelection(img.id);
        } else {
          onImageClick(img);
        }
      }}
    >
      {isSelectionMode && (
        <div
          className={`absolute top-3 right-3 z-20 w-5 h-5 rounded border shadow-sm flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-black/40 border-white/60 hover:bg-black/60'
          }`}
        >
          {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
        </div>
      )}

      {/* More Options Menu */}
      {!isSelectionMode && (
        <div ref={menuRef} className="absolute top-3 right-3 z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-2 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-all duration-300"
          >
            <div className="flex flex-col gap-[5px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              <div className="w-[5px] h-[5px] bg-white rounded-full" />
              <div className="w-[5px] h-[5px] bg-white rounded-full" />
              <div className="w-[5px] h-[5px] bg-white rounded-full" />
            </div>
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute top-full right-0 mt-1 py-1 min-w-[120px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg overflow-hidden">
              {/* Like */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLiked?.(img.id);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-200 hover:bg-white/10 transition-colors"
              >
                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                {isLiked ? '取消喜欢' : '喜欢'}
              </button>

              {/* Download */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload?.(img.id, img.filename);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-200 hover:bg-white/10 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                下载
              </button>

              {/* Delete (Admin Only) */}
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(img.id, e);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Like Button */}
      {!isSelectionMode && onToggleLiked && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLiked(img.id);
          }}
          className={`absolute bottom-3 right-3 z-20 p-2 rounded-full transition-all duration-300 ${
            isLiked 
              ? 'bg-red-500/10 text-red-500 opacity-100' 
              : 'bg-black/20 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/40 hover:text-white'
          }`}
        >
          <Heart 
            className={`w-5 h-5 transition-transform duration-200 ${isLiked ? 'fill-current scale-110' : 'scale-100'}`} 
            strokeWidth={2.5}
          />
        </button>
      )}

      <div
        className={`w-full h-full relative ${aspectClass}`}
        style={{ backgroundColor: img.dominant_color || '#1f2937' }}
      >
        {/* Layer 1: Placeholder (Blurhash or TinyUrl) */}
        {img.blurhash ? (
          <div className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${smallLoaded ? 'opacity-0' : 'opacity-100'}`}>
            <BlurhashCanvas hash={img.blurhash} />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tinyUrl}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-50 transition-opacity duration-500 ${
              smallLoaded ? 'opacity-0' : 'opacity-50'
            }`}
            aria-hidden="true"
          />
        )}

        {/* Layer 2: Small Image (Base) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={smallUrl}
          alt={img.filename}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            smallLoaded ? 'opacity-100' : 'opacity-0'
          } transition-transform duration-700 group-hover:scale-105`}
          loading="lazy"
          decoding="async"
          onLoad={() => setSmallLoaded(true)}
        />

        {/* Layer 3: Large Image (High Res) */}
        {loadHighRes && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={largeUrl}
            alt={img.filename}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              largeLoaded ? 'opacity-100' : 'opacity-0'
            } transition-transform duration-700 group-hover:scale-105`}
            loading="lazy"
            decoding="async"
            onLoad={() => setLargeLoaded(true)}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent hidden md:block opacity-0 group-hover:opacity-100 transition-opacity duration-300" />     

        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 md:translate-y-2 md:group-hover:translate-y-0 opacity-0 md:group-hover:opacity-100 transition-all duration-300 hidden md:block pointer-events-none">
          <p className="text-[10px] md:text-xs text-gray-300 line-clamp-2 leading-relaxed pr-8">
            {img.filename}
          </p>
        </div>
      </div>
    </motion.div>
  );
}, (prev, next) => {
  return (
    prev.img.id === next.img.id &&
    prev.img.like_count === next.img.like_count &&
    prev.isSelectionMode === next.isSelectionMode &&
    prev.isSelected === next.isSelected &&
    prev.isAdmin === next.isAdmin &&
    prev.loadHighRes === next.loadHighRes
  );
});
