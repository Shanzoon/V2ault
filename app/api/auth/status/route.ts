import { NextResponse } from 'next/server';
import { isAdmin } from '@/app/lib/auth';

export async function GET() {
  try {
    const adminStatus = await isAdmin();

    return NextResponse.json({ isAdmin: adminStatus });
  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json({ isAdmin: false });
  }
}
