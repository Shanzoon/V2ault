import { NextResponse } from 'next/server';
import { query, queryOne, errorResponse } from '@/app/lib';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const imageId = parseInt(id);

    if (isNaN(imageId)) {
      return errorResponse('Invalid image ID', 400);
    }

    // 查询当前状态
    const image = await queryOne<{ id: number; like_count: number }>(
      'SELECT id, like_count FROM images WHERE id = $1',
      [imageId]
    );

    if (!image) {
      return errorResponse('Image not found', 404);
    }

    // 切换点赞状态
    const newStatus = (image.like_count && image.like_count > 0) ? 0 : 1;

    await query('UPDATE images SET like_count = $1 WHERE id = $2', [newStatus, imageId]);

    return NextResponse.json({ liked: newStatus === 1 });
  } catch (error) {
    console.error('Error toggling like:', error);
    return errorResponse('Internal Server Error', 500);
  }
}
