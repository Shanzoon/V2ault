'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Palette, Keyboard, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'v2ault_onboarding_completed';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector: string | null;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'upload',
    title: '上传图片',
    description: '点击上传按钮，添加你的图片素材',
    icon: <Upload className="w-5 h-5" />,
    targetSelector: '[data-onboarding="upload"]',
  },
  {
    id: 'style',
    title: '风格筛选',
    description: '选择风格分类，快速浏览不同类型的图片',
    icon: <Palette className="w-5 h-5" />,
    targetSelector: '[data-onboarding="style"]',
  },
  {
    id: 'shortcuts',
    title: '快捷键',
    description: '使用快捷键提升操作效率',
    icon: <Keyboard className="w-5 h-5" />,
    targetSelector: '[data-onboarding="shortcuts-modal"]',
  },
];

interface OnboardingGuideProps {
  onComplete: () => void;
  onShowShortcuts: () => void;
  isShortcutsOpen: boolean;
}

export function OnboardingGuide({ onComplete, onShowShortcuts, isShortcutsOpen }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const isShortcutsStep = currentStep === 2;

  // 第三步时自动打开快捷键面板
  useEffect(() => {
    if (isShortcutsStep && !isShortcutsOpen) {
      onShowShortcuts();
    }
  }, [isShortcutsStep, isShortcutsOpen, onShowShortcuts]);

  // 更新目标元素位置
  useEffect(() => {
    const step = STEPS[currentStep];
    if (!step.targetSelector) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.querySelector(step.targetSelector!);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
    };

    // 第三步需要等待面板渲染
    if (isShortcutsStep) {
      const timer = setTimeout(updateRect, 50);
      return () => clearTimeout(timer);
    }

    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [currentStep, isShortcutsStep, isShortcutsOpen]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const padding = 8;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200]">
        {/* 统一遮罩层 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={handleSkip}
        />

        {/* 高亮边框动画 */}
        {targetRect && (
          <motion.div
            key={`border-${currentStep}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute pointer-events-none z-[201]"
            style={{
              left: targetRect.left - padding,
              top: targetRect.top - padding,
              width: targetRect.width + padding * 2,
              height: targetRect.height + padding * 2,
            }}
          >
            <div className="w-full h-full rounded-xl border-2 border-orange-500 animate-pulse" />
          </motion.div>
        )}

        {/* 提示气泡 */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute z-[202]"
          style={
            targetRect
              ? isShortcutsStep
                ? {
                    // 快捷键面板下方
                    left: targetRect.left + targetRect.width / 2,
                    top: targetRect.bottom + 16,
                    transform: 'translateX(-50%)',
                  }
                : {
                    left: targetRect.right + 16,
                    top: targetRect.top,
                  }
              : {
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }
          }
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-black/70 backdrop-blur-xl rounded-2xl shadow-2xl w-[260px] overflow-hidden p-4">
            {/* Header + Content */}
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-orange-500/20 rounded-xl text-orange-400 shrink-0">
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-white">{step.title}</span>
                  <button
                    onClick={handleSkip}
                    className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    跳过
                  </button>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>

            {/* Button with progress */}
            <button
              onClick={handleNext}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold rounded-xl transition-colors"
            >
              <span>{isLastStep ? '开始探索' : '下一步'}</span>
              <span className="text-orange-200">({currentStep + 1}/{STEPS.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// 重置引导状态
export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY);
}

// 检查是否已完成引导
export function isOnboardingCompleted() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}
