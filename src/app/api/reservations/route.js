import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';
import { requireAdmin } from '../../../lib/auth';

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const reservations = await prisma.reservation.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ reservations });
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : error.code === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ error: 'Unauthorized' }, { status });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, phone, email, date, time, guests, specialRequests } = body;
    if (!name || !phone || !date || !time) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    const reservation = await prisma.reservation.create({ data: { name, phone, email, date, time, guests: guests || 1, specialRequests, status: 'PENDING' } });
    await sendWhatsAppMessage(`New reservation from ${name} on ${date} at ${time} for ${guests || 1} guests. Phone: ${phone}`);
    return NextResponse.json({ success: true, reservation });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}

export async function PUT(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const { id, status } = await request.json();
    const updated = await prisma.reservation.update({ where: { id }, data: { status } });
    return NextResponse.json({ success: true, reservation: updated });
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : error.code === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}