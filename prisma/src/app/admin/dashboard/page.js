import AdminLayout from '../../../components/AdminLayout';
import { prisma } from '../../../lib/prisma';

export const metadata = { title: 'Admin Dashboard | Al Dayaa' };

async function getStats() {
  const [reservationsToday, ordersToday, menuCount, photoCount, latestReservations, latestOrders] = await Promise.all([
    prisma.reservation.count({ where: { date: new Date().toISOString().slice(0, 10) } }),
    prisma.order.count({ where: { createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
    prisma.menuItem.count(),
    prisma.photo.count(),
    prisma.reservation.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { items: true } })
  ]);
  return { reservationsToday, ordersToday, menuCount, photoCount, latestReservations, latestOrders };
}

export default async function DashboardPage() {
  const stats = await getStats();
  return (
    <AdminLayout>
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="section-bg p-4"><p className="text-sm text-textdark/70">Today Reservations</p><p className="text-2xl font-semibold">{stats.reservationsToday}</p></div>
        <div className="section-bg p-4"><p className="text-sm text-textdark/70">Today Orders</p><p className="text-2xl font-semibold">{stats.ordersToday}</p></div>
        <div className="section-bg p-4"><p className="text-sm text-textdark/70">Menu Items</p><p className="text-2xl font-semibold">{stats.menuCount}</p></div>
        <div className="section-bg p-4"><p className="text-sm text-textdark/70">Gallery Photos</p><p className="text-2xl font-semibold">{stats.photoCount}</p></div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="section-bg p-4">
          <h3 className="font-semibold mb-3">Latest Reservations</h3>
          <div className="space-y-2 text-sm">
            {stats.latestReservations.map((r) => (
              <div key={r.id} className="border-b pb-2">
                <p className="font-semibold">{r.name} - {r.date} {r.time}</p>
                <p>{r.phone}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="section-bg p-4">
          <h3 className="font-semibold mb-3">Latest Orders</h3>
          <div className="space-y-2 text-sm">
            {stats.latestOrders.map((o) => (
              <div key={o.id} className="border-b pb-2">
                <p className="font-semibold">{o.name} - {o.deliveryType}</p>
                <p>Total AED {o.totalPrice?.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}