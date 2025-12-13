import { NextResponse } from 'next/server';
import { withDatabase, errorResponse } from '@/app/lib';

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

    return await withDatabase((db) => {
      const image = db.prepare('SELECT id, like_count FROM images WHERE id = ?').get(imageId) as { id: number, like_count: number } | undefined;

      if (!image) {
        return errorResponse('Image not found', 404);
      }

      const newStatus = (image.like_count && image.like_count > 0) ? 0 : 1;
      
      db.prepare('UPDATE images SET like_count = ? WHERE id = ?').run(newStatus, imageId);

      return NextResponse.json({ liked: newStatus === 1 });
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    return errorResponse('Internal Server Error', 500);
  }
}
