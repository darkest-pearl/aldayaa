import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRestaurantStaffFromRequest } from '../../../../../lib/restaurant-staff-auth';
import TenantAdminNav from '../TenantAdminNav';
import TenantOrdersClient from './TenantOrdersClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Orders Admin' };

export default async function TenantOrdersAdminPage({ params }) {
  const staff = await getRestaurantStaffFromRequest(cookies());

  if (!staff || staff.restaurantSlug !== params.restaurantSlug) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="orders" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant-scoped operations</p>
          <h2 className="mt-1 text-2xl font-semibold">Orders</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            View tenant orders and update status for {params.restaurantSlug}. This is a read/status management foundation:
            public tenant ordering creates orders only when ONLINE_ORDERING is enabled, and no payments, messaging, or inventory workflow is triggered.
          </p>
        </div>
        <TenantOrdersClient restaurantSlug={params.restaurantSlug} staffRole={staff.role} />
      </section>
    </main>
  );
}
