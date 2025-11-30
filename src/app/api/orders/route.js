import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';
import { requireAdmin } from '../../../lib/auth';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, include: { items: true } });
    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, phone, deliveryType, address, notes, items } = body;
    if (!name || !phone || !deliveryType || !items?.length) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order = await prisma.order.create({
      data: {
        name,
        phone,
        deliveryType,
        address: deliveryType === 'DELIVERY' ? address : '',
        notes,
        totalPrice,
        status: 'NEW',
        items: { create: items.map((item) => ({ itemId: item.id, name: item.name, price: item.price, quantity: item.quantity })) }
      },
      include: { items: true }
    });
    await sendWhatsAppMessage(`New order from ${name}. Total AED ${totalPrice.toFixed(2)}.`);
    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}

export async function PUT(request) {
  try {
    await requireAdmin(request);
    const { id, status } = await request.json();
    const order = await prisma.order.update({ where: { id }, data: { status } });
    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}