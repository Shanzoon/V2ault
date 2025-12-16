import { NextResponse } from 'next/server';
import {
  withDatabase,
  errorResponse,
  getErrorMessage,
  DatabaseError,
} from '@/app/lib';

// 禁用缓存，确保始终获取最新数据
export const dynamic = 'force-dynamic';

interface StyleRow {
  source: string;
  style: string;
}

export async function GET() {
  try {
    const result = await withDatabase((db) => {
      // 获取所有唯一的 source + style 组合
      const styles = db.prepare(`
        SELECT DISTINCT source, style
        FROM images
        WHERE style IS NOT NULL
          AND style != ''
          AND source IN ('2D', '3D', 'Real')
        ORDER BY source, style
      `).all() as StyleRow[];

      // 按 source 分组
      const grouped: Record<string, string[]> = {
        '2D': [],
        '3D': [],
        'Real': []
      };

      for (const row of styles) {
        if (row.source in grouped) {
          grouped[row.source].push(row.style);
        }
      }

      // 中文友好排序
      for (const key of Object.keys(grouped)) {
        grouped[key].sort((a, b) => a.localeCompare(b, 'zh-CN'));
      }

      return grouped;
    }, true);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: unknown) {
    console.error('API Error fetching styles:', error);

    if (error instanceof DatabaseError) {
      return errorResponse(error.message, 503, undefined, error.code);
    }

    return errorResponse('Failed to fetch styles', 500, getErrorMessage(error));
  }
}
