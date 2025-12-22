import { NextResponse } from 'next/server';
import { query, errorResponse, getErrorMessage } from '@/app/lib';

export const dynamic = 'force-dynamic';

/**
 * POST /api/images/shuffle - 重新打乱所有图片的随机排序
 */
export async function POST() {
  try {
    const result = await query('UPDATE images SET random_order = random() WHERE deleted_at IS NULL');
    console.log(`[Shuffle] Updated ${result.rowCount} images`);

    return NextResponse.json({
      success: true,
      updated: result.rowCount,
    });
  } catch (error) {
    console.error('[Shuffle] Error:', error);
    return errorResponse('Shuffle failed', 500, getErrorMessage(error));
  }
}
