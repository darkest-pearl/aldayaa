'use client';

import AdminCard from '../../components/AdminCard';
import AdminPageHeader from '../../components/AdminPageHeader';
import AdminTable from '../../components/AdminTable';

export default function DashboardClient({ stats }) {
  const {
    reservationsToday,
    ordersToday,
    menuCount,
    photoCount,
    latestReservations,
    latestOrders,
  } = stats;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin dashboard"
        description="Overview of today’s activity and recent operations."
      />

      {/* Top stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <AdminCard title="Today reservations" description="Booked for today">
          <p className="text-2xl font-semibold">{reservationsToday}</p>
        </AdminCard>
        <AdminCard title="Today orders" description="Online + phone orders today">
          <p className="text-2xl font-semibold">{ordersToday}</p>
        </AdminCard>
        <AdminCard title="Menu items" description="Active dishes on the menu">
          <p className="text-2xl font-semibold">{menuCount}</p>
        </AdminCard>
        <AdminCard title="Gallery photos" description="Published photos">
          <p className="text-2xl font-semibold">{photoCount}</p>
        </AdminCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Latest reservations */}
        <AdminCard title="Latest reservations">
          <AdminTable
            dense
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'phone', header: 'Phone' },
              { key: 'date', header: 'Date' },
              { key: 'time', header: 'Time' },
              { key: 'status', header: 'Status' },
            ]}
            rows={latestReservations || []}
            emptyMessage="No recent reservations"
          />
        </AdminCard>

        {/* Latest orders */}
        <AdminCard title="Latest orders">
          <AdminTable
            dense
            columns={[
              { key: 'name', header: 'Customer' },
              { key: 'deliveryType', header: 'Type' },
              {
                key: 'totalPrice',
                header: 'Total',
                render: (val) => `AED ${Number(val || 0).toFixed(2)}`,
              },
              { key: 'status', header: 'Status' },
            ]}
            rows={latestOrders || []}
            emptyMessage="No recent orders"
          />
        </AdminCard>
      </div>
    </div>
  );
}
