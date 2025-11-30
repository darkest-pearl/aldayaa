import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requireAdmin } from '../../../../../lib/auth';

export async function PUT(request, { params }) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const photo = await prisma.photo.update({ where: { id: params.id }, data: body });
    return NextResponse.json({ success: true, photo });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request);
    await prisma.photo.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}