import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireAdmin } from "../../../../lib/auth";

export async function GET(request) {
  await requireAdmin(request);

  const stats = await getStats();
  return NextResponse.json(stats);
}

async function getStats() {
  return {
    reservationsToday: await prisma.reservation.count(),
    ordersToday: await prisma.order.count(),
    menuCount: await prisma.menuItem.count(),
    photoCount: await prisma.photo.count(),
  };
}
