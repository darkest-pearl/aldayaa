import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const items = await prisma.menuItem.findMany({ include: { category: true } });
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const item = await prisma.menuItem.create({ data: { name: body.name, description: body.description, price: body.price || 0, categoryId: body.categoryId, isAvailable: body.isAvailable !== false, imageUrl: body.imageUrl } });
    return NextResponse.json({ success: true, item });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}