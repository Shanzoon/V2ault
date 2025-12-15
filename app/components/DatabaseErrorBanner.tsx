'use client';

import { Database, AlertTriangle, Terminal, RefreshCw } from 'lucide-react';
import type { ApiError } from '../hooks';

interface DatabaseErrorBannerProps {
  error: ApiError;
  onRetry?: () => void;
}

export function DatabaseErrorBanner({ error, onRetry }: DatabaseErrorBannerProps) {
  const isDbError = error.code === 'DB_NOT_FOUND' || error.code === 'DB_NOT_INITIALIZED';

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-lg w-full mx-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 backdrop-blur-sm">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className={`p-4 rounded-full ${isDbError ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
              {isDbError ? (
                <Database className="w-12 h-12 text-amber-500" />
              ) : (
                <AlertTriangle className="w-12 h-12 text-red-500" />
              )}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-center text-white mb-2">
            {isDbError ? '数据库未就绪' : '连接失败'}
          </h2>

          {/* Message */}
          <p className="text-zinc-400 text-center mb-6">
            {error.message}
          </p>

          {/* Instructions for DB error */}
          {isDbError && (
            <div className="bg-zinc-950 rounded-xl p-4 mb-6">
              <p className="text-zinc-500 text-sm mb-3">请在终端运行以下命令初始化数据库：</p>
              <div className="flex items-center gap-2 bg-black rounded-lg px-4 py-3 font-mono text-sm">
                <Terminal className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <code className="text-emerald-400">npm run db:init</code>
              </div>
              <p className="text-zinc-600 text-xs mt-3">
                初始化完成后，点击下方按钮重试或刷新页面
              </p>
            </div>
          )}

          {/* Retry button */}
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>重试</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
