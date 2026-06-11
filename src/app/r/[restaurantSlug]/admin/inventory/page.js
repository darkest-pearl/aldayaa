import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireRestaurantStaffAccess } from '../../../../../lib/restaurant-staff-access';
import TenantAdminNav from '../TenantAdminNav';
import TenantInventoryClient from './TenantInventoryClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Inventory Admin' };

export default async function TenantInventoryAdminPage({ params }) {
  let staff;

  try {
    staff = await requireRestaurantStaffAccess(cookies(), params.restaurantSlug);
  } catch (error) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="inventory" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant-scoped stock control</p>
          <h2 className="mt-1 text-2xl font-semibold">Inventory</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Manage inventory items, low-stock visibility, and manual stock movements for {params.restaurantSlug}.
            Automatic recipe depletion, order consumption, supplier ordering, invoices, payments, and messaging are not connected here.
          </p>
        </div>
        <TenantInventoryClient restaurantSlug={params.restaurantSlug} staffRole={staff.role} />
      </section>
    </main>
  );
}
