export const dynamic = "force-dynamic";

// src/app/admin/(protected)/dashboard/page.jsx
import { prisma } from '../../../../lib/prisma';
import DashboardClient from './DashboardClient.jsx';

export const metadata = {
  title: 'Admin Dashboard',
};

async function getStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [reservationsToday, ordersToday, menuCount, photoCount] = await Promise.all([
    prisma.reservation.count({
      where: { date: new Date().toISOString().slice(0, 10) },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: startOfToday },
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
      date: r.date,
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
