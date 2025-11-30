import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const categories = await prisma.galleryCategory.findMany({ include: { photos: true } });
    return NextResponse.json({ categories });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const category = await prisma.galleryCategory.create({ data: { name: body.name } });
    return NextResponse.json({ success: true, category });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}