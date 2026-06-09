import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRestaurantStaffFromRequest } from '../../../../../lib/restaurant-staff-auth';
import TenantAdminNav from '../TenantAdminNav';
import TenantMenuClient from './TenantMenuClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Menu Admin' };

export default async function TenantMenuAdminPage({ params }) {
  const staff = await getRestaurantStaffFromRequest(cookies());

  if (!staff || staff.restaurantSlug !== params.restaurantSlug) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="menu" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant-scoped operations</p>
          <h2 className="mt-1 text-2xl font-semibold">Menu</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Changes on this page are scoped to {params.restaurantSlug}. Cross-tenant categories and items are not accessible here.
          </p>
        </div>
        <TenantMenuClient restaurantSlug={params.restaurantSlug} staffRole={staff.role} />
      </section>
    </main>
  );
}
