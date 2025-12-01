import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const categories = await prisma.galleryCategory.findMany({ include: { photos: true } });
    return NextResponse.json({ categories });
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : error.code === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ error: 'Unauthorized' }, { status });
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const category = await prisma.galleryCategory.create({ data: { name: body.name } });
    return NextResponse.json({ success: true, category });
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : error.code === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}