import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const photos = await prisma.photo.findMany({ include: { category: true } });
    return NextResponse.json({ photos });
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : error.code === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ error: 'Unauthorized' }, { status });
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    if (!body.imageUrl && !body.file) return NextResponse.json({ success: false, error: 'Image URL required' }, { status: 400 });
    const photo = await prisma.photo.create({ data: { title: body.title, description: body.description, imageUrl: body.imageUrl, categoryId: body.categoryId } });
    return NextResponse.json({ success: true, photo });
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : error.code === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}