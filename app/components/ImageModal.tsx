'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { toast } from 'sonner';
import { X, Download, Edit2, Save, Trash2, Copy, Layers, Box, Tag, Heart } from 'lucide-react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import type { Image } from '../types';

interface ImageModalProps {
  selectedImage: Image | null;
  images: Image[];
  isFullscreen: boolean;
  setIsFullscreen: (value: boolean) => void;
  setSelectedImage: (img: Image | null) => void;
  onDelete: () => void;
  onUpdateImage: (img: Image) => void;
  onToggleLiked?: (id: number) => void;
}

export function ImageModal({
  selectedImage,
  images,
  isFullscreen,
  setIsFullscreen,
  setSelectedImage,
  onDelete,
  onUpdateImage,
  onToggleLiked,
}: ImageModalProps) {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editPromptValue, setEditPromptValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const dragControls = useDragControls();

  // Reset edit state when image selection changes
  useEffect(() => {
    setIsEditingPrompt(false);
    setEditPromptValue('');
    setIsZoomed(false);
    if (selectedImage) {
      setEditPromptValue(selectedImage.prompt || '');
    }
  }, [selectedImage]);

  // Smart Image Preloading
  useEffect(() => {
    if (!selectedImage) return;

    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    if (currentIndex === -1) return;

    const preloadImage = (img: Image) => {
      const src = `/api/image/${img.id}`;
      const image = new window.Image();
      image.src = src;
    };

    // Preload Next 2 images
    for (let i = 1; i <= 2; i++) {
      if (currentIndex + i < images.length) {
        preloadImage(images[currentIndex + i]);
      }
    }

    // Preload Prev 1 image
    if (currentIndex - 1 >= 0) {
      preloadImage(images[currentIndex - 1]);
    }
  }, [selectedImage, images]);

  if (!selectedImage) return null;

  const handleSavePrompt = async () => {
    if (!selectedImage) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/images/${selectedImage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: editPromptValue }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      const updatedImage = { ...selectedImage, prompt: data.prompt };
      onUpdateImage(updatedImage);
      setIsEditingPrompt(false);
    } catch (error) {
      console.error('Error updating prompt:', error);
      alert('Failed to update prompt');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!selectedImage?.prompt) return;
    try {
      await navigator.clipboard.writeText(selectedImage.prompt);
      toast.success('Prompt copied to clipboard');
    } catch (err) {
      console.error('Failed to copy prompt:', err);
      toast.error('Failed to copy prompt');
    }
  };

  const handleNextImage = () => {
    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    if (currentIndex !== -1 && currentIndex < images.length - 1) {
      setSlideDirection(1);
      setSelectedImage(images[currentIndex + 1]);
    }
  };

  const handlePrevImage = () => {
    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    if (currentIndex > 0) {
      setSlideDirection(-1);
      setSelectedImage(images[currentIndex - 1]);
    }
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const handleSwipe = (_e: unknown, { offset, velocity }: { offset: { x: number }; velocity: { x: number } }) => {
    const swipe = swipePower(offset.x, velocity.x);

    if (swipe < -swipeConfidenceThreshold) {
      handleNextImage();
    } else if (swipe > swipeConfidenceThreshold) {
      handlePrevImage();
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/83 backdrop-blur-xl overflow-hidden"
      onClick={() => setSelectedImage(null)}
    >
      {/* Mobile Close Button */}
      <button
        onClick={() => setSelectedImage(null)}
        className="fixed top-4 right-4 z-[60] p-2 bg-black/50 text-white rounded-full backdrop-blur-md md:hidden"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Mobile Swiper Layout (md:hidden) */}
      <div className="md:hidden absolute inset-0 z-10 flex items-center bg-black overflow-hidden touch-pan-x">
        <Swiper
          spaceBetween={0}
          slidesPerView={1}
          initialSlide={images.findIndex(img => img.id === selectedImage.id)}
          onSlideChange={(swiper) => {
            const img = images[swiper.activeIndex];
            if (img && img.id !== selectedImage.id) {
              setSelectedImage(img);
            }
          }}
          className="w-full h-full"
          touchStartPreventDefault={false}
          touchMoveStopPropagation={true}
          simulateTouch={true}
          allowTouchMove={true}
          threshold={5}
          touchRatio={1.2}
          speed={300}
          resistance={true}
          resistanceRatio={0.85}
        >
          {images.map((img) => (
            <SwiperSlide key={img.id} className="!flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/image/${img.id}`}
                alt={img.filename}
                className="w-full h-full object-contain"
                loading="lazy"
                draggable={false}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* Mobile Bottom Sheet (md:hidden) */}
      <motion.div
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#1a1a1a] rounded-t-2xl shadow-[0_-5px_20px_rgba(0,0,0,0.5)] border-t border-white/10 flex flex-col touch-pan-y"
        initial="collapsed"
        animate={isMobileDetailOpen ? 'expanded' : 'collapsed'}
        variants={{
          collapsed: { height: '100px' },
          expanded: { height: '80%' },
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_e, { offset, velocity }) => {
          if (offset.y < -50 || velocity.y < -500) {
            setIsMobileDetailOpen(true);
          } else if (offset.y > 50 || velocity.y > 500) {
            setIsMobileDetailOpen(false);
          }
        }}
      >
        {/* Drag Handle & Header */}
        <div
          className="h-[100px] w-full flex-none p-4 flex flex-col items-center gap-3 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={(e) => dragControls.start(e)}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
          <div className="w-full flex justify-between items-center px-2">
            <div className="overflow-hidden">
              <h3 className="text-white font-bold truncate max-w-[200px]">{selectedImage.filename}</h3>
              <p className="text-xs text-gray-500">
                {selectedImage.width} × {selectedImage.height}
              </p>
            </div>
            <a
              href={`/api/image/${selectedImage.id}`}
              download={selectedImage.filename}
              className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Scrollable Content (Visible only when expanded) */}
        <div
          className="flex-1 overflow-y-auto px-6 pb-8 custom-scrollbar bg-[#1a1a1a]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-6 pt-2">
            {/* Prompt */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Edit2 className="w-3 h-3" /> Prompt
              </label>
              <p className="text-sm text-gray-300 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
                {selectedImage.prompt}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Box className="w-3 h-3" /> Model
              </label>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white/5 rounded-full text-xs border border-white/5 text-gray-300">
                  Illustrious
                </span>
              </div>
            </div>

            <button
              onClick={onDelete}
              className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-400 py-3 rounded-xl text-sm font-bold border border-red-500/20 mt-8"
            >
              <Trash2 className="w-4 h-4" /> Delete Asset
            </button>
          </div>
        </div>
      </motion.div>

      {/* Desktop Layout (md:flex) */}
      <div
        className={`hidden md:flex relative w-full h-full flex-col md:flex-row items-center justify-center mx-auto transition-all duration-300 ${
          isFullscreen ? 'max-w-none p-0' : 'max-w-[1800px] md:p-8 gap-0 md:gap-6'
        }`}
      >
        {/* Left/Middle: Image Display Area */}
        {/* Left/Middle: Image Display Area */}
<div
  className={`relative flex items-center justify-center overflow-hidden ${
    isFullscreen ? 'w-full h-screen' : 'w-full md:w-auto h-[85vh] md:h-full md:flex-1'
  }`}
  onClick={(e) => {
    e.stopPropagation();
    if (isFullscreen) {
      setIsFullscreen(false);
      setIsZoomed(false);
    } else {
      setSelectedImage(null);
    }
  }}
>

          {isFullscreen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(false);
                setIsZoomed(false);
              }}
              className="absolute top-6 right-6 z-50 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}

          {isFullscreen ? (
            <TransformWrapper
              ref={transformRef}
              initialScale={1}
              minScale={0.5}
              maxScale={8}
              centerOnInit={true}
              wheel={{ step: 0.1 }}
              doubleClick={{ mode: 'reset' }}
            >
              <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/image/${selectedImage.id}`}
                  alt={selectedImage.filename}
                  className={`w-full h-full object-contain ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isZoomed) {
                      transformRef.current?.resetTransform();
                    } else {
                      transformRef.current?.zoomIn(1);
                    }
                    setIsZoomed(!isZoomed);
                  }}
                />
              </TransformComponent>
            </TransformWrapper>
          ) : (
            <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
              <motion.div
                key={selectedImage.id}
                custom={slideDirection}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
                drag={isFullscreen ? false : 'x'}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={1}
                onDragEnd={handleSwipe}
                className="absolute inset-0 flex items-center justify-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/image/${selectedImage.id}`}
                  alt={selectedImage.filename}
                  className="max-w-full max-h-full object-contain shadow-2xl drop-shadow-2xl md:cursor-zoom-in pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFullscreen(true);
                  }}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Right: Info Card */}
        {!isFullscreen && (
          <div
            className="w-full md:w-[400px] shrink-0 flex flex-col md:justify-center animate-in slide-in-from-bottom-10 md:slide-in-from-right-10 fade-in duration-300 flex-1 md:flex-none min-h-[50vh] md:min-h-0 bg-[#1a1a1a] md:bg-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1a1a1a] md:rounded-xl border-t md:border border-white/10 p-6 shadow-2xl flex flex-col h-full md:h-auto md:max-h-[90vh] overflow-hidden">
              {/* Header: Title & Close */}
              <div className="flex justify-between items-start mb-6">
                <div className="overflow-hidden">
                  <h3
                    className="text-xl font-bold text-white mb-1 truncate pr-2"
                    title={selectedImage.filename}
                  >
                    {selectedImage.filename}
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                    <span className="bg-white/5 px-2 py-0.5 rounded">
                      {selectedImage.width} × {selectedImage.height}
                    </span>
                    <span>
                      {Math.round((selectedImage.width * selectedImage.height) / 1000000 * 10) / 10} MP
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="hidden md:block text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg shrink-0"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Metadata Fields */}
              <div className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {/* SOURCE (Mock) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Source
                  </label>
                  <div className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-gray-300">
                    Anime Style
                  </div>
                </div>

                {/* PROMPT */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Edit2 className="w-3 h-3" /> Prompt
                    </label>
                    <div className="flex gap-1">
                      <button
                        onClick={handleCopyPrompt}
                        className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                        className={`p-1.5 rounded transition-colors ${
                          isEditingPrompt
                            ? 'text-cyan-400 bg-cyan-400/10'
                            : 'text-gray-500 hover:text-white hover:bg-white/10'
                        }`}
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isEditingPrompt ? (
                    <div className="space-y-2">
                      <textarea
                        value={editPromptValue}
                        onChange={(e) => setEditPromptValue(e.target.value)}
                        className="w-full min-h-[160px] bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-gray-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none custom-scrollbar"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setIsEditingPrompt(false)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSavePrompt}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-cyan-600 text-white text-xs font-bold rounded hover:bg-cyan-500 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-cyan-900/20"
                        >
                          {isSaving ? (
                            'Saving...'
                          ) : (
                            <>
                              <Save className="w-3 h-3" /> Save
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full min-h-[120px] max-h-[200px] bg-black/20 border border-transparent hover:border-white/5 rounded-lg p-3 overflow-y-auto custom-scrollbar group transition-colors cursor-default">
                      <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap group-hover:text-gray-300 transition-colors">
                        {selectedImage.prompt}
                      </p>
                    </div>
                  )}
                </div>

                {/* MODEL BASE (Mock) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <Box className="w-3 h-3" /> Model Base
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white border border-white/5 shadow-sm">
                      Illustrious
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-gray-400 border border-white/5">
                      SDXL
                    </span>
                  </div>
                </div>

                {/* TAGS (Mock) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['#anime', '#masterpiece', '#best quality', '#4k'].map((tag, i) => (
                      <span
                        key={i}
                        className="text-xs text-gray-500 hover:text-cyan-400 cursor-pointer transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer: Actions */}
              <div className="pt-6 mt-2 flex items-center gap-2 border-t border-white/5">
                {/* Like Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLiked?.(selectedImage.id);
                  }}
                  className={`p-3 rounded-lg transition-colors border ${
                    selectedImage.like_count && selectedImage.like_count > 0
                      ? 'bg-red-500/10 border-red-500/20 text-red-500'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                  title={selectedImage.like_count && selectedImage.like_count > 0 ? 'Unlike' : 'Like'}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      selectedImage.like_count && selectedImage.like_count > 0 ? 'fill-current' : ''
                    }`}
                  />
                </button>

                {/* Download Button */}
                <a
                  href={`/api/image/${selectedImage.id}`}
                  download={selectedImage.filename}
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-black py-3 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                  <Download className="w-4 h-4" /> Download Asset
                </a>

                {/* Delete Button */}
                <button
                  onClick={onDelete}
                  className="flex-1 flex items-center justify-center gap-2 bg-transparent text-red-500/80 hover:text-red-400 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-red-500/10 border border-red-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
