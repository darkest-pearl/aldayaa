import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRestaurantStaffFromRequest } from '../../../../../lib/restaurant-staff-auth';
import TenantAdminNav from '../TenantAdminNav';
import TenantTablesClient from './TenantTablesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Tables Admin' };

export default async function TenantTablesAdminPage({ params }) {
  const staff = await getRestaurantStaffFromRequest(cookies());

  if (!staff || staff.restaurantSlug !== params.restaurantSlug) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="tables" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant-scoped setup</p>
          <h2 className="mt-1 text-2xl font-semibold">Tables</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Create and manage table labels, zones, seats, active state, and QR token references for {params.restaurantSlug}.
            This prepares QR/table setup but does not activate tenant table ordering or create orders.
          </p>
        </div>
        <TenantTablesClient restaurantSlug={params.restaurantSlug} staffRole={staff.role} />
      </section>
    </main>
  );
}
