import { NextResponse } from 'next/server';
import {
  queryAll,
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
    // 获取所有唯一的 source + style 组合
    const styles = await queryAll<StyleRow>(`
      SELECT DISTINCT source, style
      FROM images
      WHERE style IS NOT NULL
        AND style != ''
        AND source IN ('2D', '3D', 'Real')
      ORDER BY source, style
    `);

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

    return NextResponse.json(grouped, {
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
