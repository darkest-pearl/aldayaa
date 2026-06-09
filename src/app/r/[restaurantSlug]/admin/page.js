import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRestaurantStaffFromRequest } from '../../../../lib/restaurant-staff-auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Restaurant Staff Admin' };

export default async function TenantRestaurantAdminPage({ params }) {
  const staff = await getRestaurantStaffFromRequest(cookies());

  if (!staff || staff.restaurantSlug !== params.restaurantSlug) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-[60vh] px-4 py-10">
      <section className="mx-auto max-w-5xl rounded-lg border border-white/10 bg-white p-6 text-neutral-950 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Restaurant staff access is active</p>
        <h1 className="mt-2 text-3xl font-semibold">Tenant admin foundation</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
          You are signed in as {staff.email} for {staff.restaurantSlug} with {staff.role} access.
          Operational tools are not enabled yet.
        </p>
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          This dashboard verifies restaurant-scoped authentication only. Menu, gallery, orders, settings,
          inventory, recipes, billing, and messaging tools remain future tenant admin work.
        </div>
      </section>
    </main>
  );
}
