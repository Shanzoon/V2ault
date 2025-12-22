'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import OSS from 'ali-oss';

// 并发数
const CONCURRENCY = 4;
// 重试次数
const MAX_RETRIES = 3;

// 压缩配置（可扩展为用户设置）
const COMPRESSION_CONFIG = {
  enabled: true,              // 是否启用压缩
  maxSizeMB: 2,               // 最大文件大小 MB
  maxWidthOrHeight: 2560,     // 最大宽高
  useWebWorker: true,         // 使用 Web Worker
  fileType: 'image/webp',     // 输出格式
  initialQuality: 0.85,       // 压缩质量
};

export interface UploadTask {
  id: string;
  file: File;
  metadata: {
    title: string;
    prompt: string;
    model_base: string;
    source: string;
    style: string;
    imported_at: string;
  };
  status: 'pending' | 'compressing' | 'uploading' | 'registering' | 'success' | 'error';
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

interface StsCredentials {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  expiration: string;
}

interface StsResponse {
  success: boolean;
  credentials: StsCredentials;
  config: {
    bucket: string;
    region: string;
    uploadPath: string;
  };
}

// STS 凭证缓存
let cachedSts: StsResponse | null = null;
let stsExpireTime: number = 0;

/**
 * 获取 STS 凭证（带缓存）
 */
async function getStsCredentials(): Promise<StsResponse> {
  // 提前 2 分钟刷新凭证
  if (cachedSts && Date.now() < stsExpireTime - 120000) {
    return cachedSts;
  }

  const response = await fetch('/api/oss/sts');
  if (!response.ok) {
    throw new Error('获取上传凭证失败');
  }

  const data: StsResponse = await response.json();
  if (!data.success) {
    throw new Error('获取上传凭证失败');
  }

  cachedSts = data;
  stsExpireTime = new Date(data.credentials.expiration).getTime();
  return data;
}

/**
 * 生成 OSS 对象键名
 */
function generateOssKey(uploadPath: string, filename: string): string {
  const ext = '.webp';
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const cleanName = baseName.replace(/[^\w\u4e00-\u9fa5-]/g, '_').slice(0, 50);
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${uploadPath}${cleanName}_${timestamp}_${randomStr}${ext}`;
}

/**
 * 压缩图片
 */
async function compressImage(file: File): Promise<File> {
  if (!COMPRESSION_CONFIG.enabled) {
    return file;
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: COMPRESSION_CONFIG.maxSizeMB,
      maxWidthOrHeight: COMPRESSION_CONFIG.maxWidthOrHeight,
      useWebWorker: COMPRESSION_CONFIG.useWebWorker,
      fileType: COMPRESSION_CONFIG.fileType,
      initialQuality: COMPRESSION_CONFIG.initialQuality,
    });
    return compressed;
  } catch (error) {
    console.warn('[Compress] Failed, using original file:', error);
    return file;
  }
}

/**
 * 获取图片尺寸
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
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

  useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete;
  }, [onUploadComplete]);

  const completedCount = tasks.filter((t) => t.status === 'success').length;
  const failedCount = tasks.filter((t) => t.status === 'error').length;
  const totalCount = tasks.length;

  // 上传单个文件到 OSS（带重试）
  const uploadSingleFile = useCallback(
    async (
      task: UploadTask,
      updateStatus: (status: UploadTask['status']) => void
    ): Promise<boolean> => {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // 1. 压缩图片
          updateStatus('compressing');
          const compressedFile = await compressImage(task.file);
          const dimensions = await getImageDimensions(compressedFile);

          // 2. 获取 STS 凭证
          const sts = await getStsCredentials();

          // 3. 创建 OSS 客户端
          const ossClient = new OSS({
            region: sts.config.region,
            bucket: sts.config.bucket,
            accessKeyId: sts.credentials.accessKeyId,
            accessKeySecret: sts.credentials.accessKeySecret,
            stsToken: sts.credentials.securityToken,
          });

          // 4. 上传到 OSS
          updateStatus('uploading');
          const ossKey = generateOssKey(sts.config.uploadPath, task.metadata.title || task.file.name);
          await ossClient.put(ossKey, compressedFile);

          // 5. 注册到数据库
          updateStatus('registering');
          const registerResponse = await fetch('/api/images/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              images: [
                {
                  ossKey,
                  filename: task.metadata.title || task.file.name,
                  width: dimensions.width,
                  height: dimensions.height,
                  filesize: compressedFile.size,
                  metadata: {
                    prompt: task.metadata.prompt,
                    model_base: task.metadata.model_base,
                    source: task.metadata.source,
                    style: task.metadata.style,
                    imported_at: task.metadata.imported_at,
                  },
                },
              ],
            }),
          });

          const registerResult = await registerResponse.json();
          if (!registerResult.success || registerResult.failed?.length > 0) {
            throw new Error(registerResult.failed?.[0]?.error || '注册失败');
          }

          return true;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('未知错误');
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }
      }

      throw lastError || new Error('上传失败');
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

      taskQueueRef.current = [...tasksToUpload];
      processedCountRef.current = 0;

      const uploadWorker = async () => {
        while (true) {
          if (controller.signal.aborted) break;

          const task = taskQueueRef.current.shift();
          if (!task) break;

          processedCountRef.current++;
          setCurrentIndex(processedCountRef.current);

          const updateStatus = (status: UploadTask['status']) => {
            setTasks((prev) =>
              prev.map((t) => (t.id === task.id ? { ...t, status } : t))
            );
          };

          try {
            await uploadSingleFile(task, updateStatus);
            setTasks((prev) =>
              prev.map((t) => (t.id === task.id ? { ...t, status: 'success' as const } : t))
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id ? { ...t, status: 'error' as const, error: errorMessage } : t
              )
            );
          }
        }
      };

      await Promise.all(
        Array(Math.min(CONCURRENCY, tasksToUpload.length))
          .fill(null)
          .map(() => uploadWorker())
      );

      isUploadingRef.current = false;
      setIsUploading(false);
      abortControllerRef.current = null;

      if (onUploadCompleteRef.current) {
        onUploadCompleteRef.current();
      }
    },
    [uploadSingleFile]
  );

  const addTasks = useCallback(
    (newTasks: UploadTask[]) => {
      setTasks((prev) => [...prev, ...newTasks]);
      setIsVisible(true);
      processUpload(newTasks);
    },
    [processUpload]
  );

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      taskQueueRef.current = [];
    }
  }, []);

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
