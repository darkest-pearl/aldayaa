import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const photos = await prisma.photo.findMany({ include: { category: true } });
    return NextResponse.json({ photos });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    if (!body.imageUrl && !body.file) return NextResponse.json({ success: false, error: 'Image URL required' }, { status: 400 });
    const photo = await prisma.photo.create({ data: { title: body.title, description: body.description, imageUrl: body.imageUrl, categoryId: body.categoryId } });
    return NextResponse.json({ success: true, photo });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}