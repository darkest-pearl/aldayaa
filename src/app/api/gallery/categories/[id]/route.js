import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requireAdmin } from '../../../../../lib/auth';

export async function PUT(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const category = await prisma.galleryCategory.update({ where: { id: params.id }, data: body });
    return NextResponse.json({ success: true, category });
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : error.code === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN']);
    await prisma.galleryCategory.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : error.code === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}