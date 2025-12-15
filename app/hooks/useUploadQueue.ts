'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// 并发数
const CONCURRENCY = 4;

export interface UploadTask {
  id: string;
  file: File;
  metadata: {
    title: string;
    prompt: string;
    style: string;
    modelBaseId: number | null;
  };
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export interface UploadQueueState {
  tasks: UploadTask[];
  isUploading: boolean;
  currentIndex: number;
  totalCount: number;
  completedCount: number;
  failedCount: number;
}

interface UseUploadQueueReturn {
  state: UploadQueueState;
  addTasks: (tasks: UploadTask[]) => void;
  cancelUpload: () => void;
  clearQueue: () => void;
  isMinimized: boolean;
  setIsMinimized: (v: boolean) => void;
  isVisible: boolean;
  setIsVisible: (v: boolean) => void;
}

export function useUploadQueue(onUploadComplete?: () => void): UseUploadQueueReturn {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isUploadingRef = useRef(false);
  const onUploadCompleteRef = useRef(onUploadComplete);
  const taskQueueRef = useRef<UploadTask[]>([]);
  const processedCountRef = useRef(0);

  // 保持回调函数的最新引用
  useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete;
  }, [onUploadComplete]);

  // 计算统计数据
  const completedCount = tasks.filter((t) => t.status === 'success').length;
  const failedCount = tasks.filter((t) => t.status === 'error').length;
  const totalCount = tasks.length;

  // 上传单个文件
  const uploadSingleFile = useCallback(
    async (task: UploadTask, signal: AbortSignal): Promise<boolean> => {
      const formData = new FormData();
      formData.append('files', task.file);
      formData.append(
        'metadata',
        JSON.stringify([
          {
            originalFilename: task.file.name,
            title: task.metadata.title,
            prompt: task.metadata.prompt,
            style: task.metadata.style,
            modelBaseId: task.metadata.modelBaseId,
          },
        ])
      );

      try {
        const response = await fetch('/api/images/upload', {
          method: 'POST',
          body: formData,
          signal,
        });

        const result = await response.json();

        if (result.success && result.uploaded.length > 0) {
          return true;
        } else if (result.failed && result.failed.length > 0) {
          throw new Error(result.failed[0].error);
        } else {
          throw new Error(result.error || '上传失败');
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }
        throw error;
      }
    },
    []
  );

  // 内部上传函数 - 并发池模式
  const processUpload = useCallback(
    async (tasksToUpload: UploadTask[]) => {
      if (isUploadingRef.current || tasksToUpload.length === 0) return;

      isUploadingRef.current = true;
      setIsUploading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 初始化任务队列
      taskQueueRef.current = [...tasksToUpload];
      processedCountRef.current = 0;

      // 并发 worker 函数
      const uploadWorker = async () => {
        while (true) {
          if (controller.signal.aborted) break;

          // 从队列中获取下一个任务
          const task = taskQueueRef.current.shift();
          if (!task) break;

          // 更新任务状态为 uploading
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, status: 'uploading' as const } : t))
          );

          // 更新进度指示
          processedCountRef.current++;
          setCurrentIndex(processedCountRef.current);

          try {
            await uploadSingleFile(task, controller.signal);

            // 成功
            setTasks((prev) =>
              prev.map((t) => (t.id === task.id ? { ...t, status: 'success' as const } : t))
            );
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              // 用户取消，将当前任务标记回 pending
              setTasks((prev) =>
                prev.map((t) => (t.id === task.id ? { ...t, status: 'pending' as const } : t))
              );
              break;
            }

            // 其他错误
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id ? { ...t, status: 'error' as const, error: errorMessage } : t
              )
            );
          }
        }
      };

      // 启动 N 个并发 worker
      await Promise.all(
        Array(Math.min(CONCURRENCY, tasksToUpload.length))
          .fill(null)
          .map(() => uploadWorker())
      );

      isUploadingRef.current = false;
      setIsUploading(false);
      abortControllerRef.current = null;

      // 上传完成回调
      if (onUploadCompleteRef.current) {
        onUploadCompleteRef.current();
      }
    },
    [uploadSingleFile]
  );

  // 添加任务到队列并自动开始上传
  const addTasks = useCallback(
    (newTasks: UploadTask[]) => {
      setTasks((prev) => [...prev, ...newTasks]);
      setIsVisible(true);
      // 直接传递任务数组，避免闭包问题
      processUpload(newTasks);
    },
    [processUpload]
  );

  // 取消上传
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      // 清空待处理队列
      taskQueueRef.current = [];
    }
  }, []);

  // 清空队列
  const clearQueue = useCallback(() => {
    if (isUploadingRef.current) {
      cancelUpload();
    }
    setTasks([]);
    setCurrentIndex(0);
    setIsVisible(false);
    setIsMinimized(false);
  }, [cancelUpload]);

  return {
    state: {
      tasks,
      isUploading,
      currentIndex,
      totalCount,
      completedCount,
      failedCount,
    },
    addTasks,
    cancelUpload,
    clearQueue,
    isMinimized,
    setIsMinimized,
    isVisible,
    setIsVisible,
  };
}
