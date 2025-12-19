export const dynamic = "force-dynamic";

// src/app/admin/(protected)/dashboard/page.jsx
import { prisma } from '../../../../lib/prisma';
import DashboardClient from './DashboardClient.jsx';

export const metadata = {
  title: 'Admin Dashboard',
};

function getDubaiDayRange() {
  const now = new Date();

  // Dubai is UTC+4
  const dubaiOffsetMs = 4 * 60 * 60 * 1000;

  // Convert "now" to Dubai time
  const dubaiNow = new Date(now.getTime() + dubaiOffsetMs);

  // Start of Dubai day
  const dubaiStart = new Date(dubaiNow);
  dubaiStart.setHours(0, 0, 0, 0);

  // End of Dubai day
  const dubaiEnd = new Date(dubaiNow);
  dubaiEnd.setHours(23, 59, 59, 999);

  // Convert back to UTC for database comparison
  const startUtc = new Date(dubaiStart.getTime() - dubaiOffsetMs);
  const endUtc = new Date(dubaiEnd.getTime() - dubaiOffsetMs);

  return { startUtc, endUtc };
}


async function getStats() {
  const { startUtc, endUtc } = getDubaiDayRange();
  
  const [reservationsToday, ordersToday, menuCount, photoCount] = await Promise.all([
    prisma.reservation.count({
      where: {
        date: {
          gte: startUtc,
          lte: endUtc,
        },
      },
    }),
    prisma.order.count({
      where: {
        createdAt: {
          gte: startUtc,
          lte: endUtc,
        },
      },
    }),

    prisma.menuItem.count(),
    prisma.photo.count(),
  ]);

  const latestReservations = await prisma.reservation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const latestOrders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      items: true,
    },
  });

  return {
    reservationsToday,
    ordersToday,
    menuCount,
    photoCount,
    latestReservations: latestReservations.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
      time: r.time,
      status: r.status,
    })),
    latestOrders: latestOrders.map((o) => ({
      id: o.id,
      name: o.name,
      phone: o.phone,
      deliveryType: o.deliveryType,
      totalPrice: o.totalPrice,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

export default async function DashboardPage() {
  const stats = await getStats();
  return <DashboardClient stats={stats} />;
}
