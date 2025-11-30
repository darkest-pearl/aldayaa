import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';
import { requireAdmin } from '../../../lib/auth';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const reservations = await prisma.reservation.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ reservations });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    await requireAdmin(request);
    const { id, status } = await request.json();
    const updated = await prisma.reservation.update({ where: { id }, data: { status } });
    return NextResponse.json({ success: true, reservation: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}