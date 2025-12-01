import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const items = await prisma.menuItem.findMany({ include: { category: true } });
    return NextResponse.json({ items });
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : error.code === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ error: 'Unauthorized' }, { status });
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const item = await prisma.menuItem.create({ data: { name: body.name, description: body.description, price: body.price || 0, categoryId: body.categoryId, isAvailable: body.isAvailable !== false, imageUrl: body.imageUrl } });
    return NextResponse.json({ success: true, item });
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : error.code === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}