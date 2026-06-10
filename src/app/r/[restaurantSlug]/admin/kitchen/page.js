import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireRestaurantStaffAccess } from '../../../../../lib/restaurant-staff-access';
import TenantAdminNav from '../TenantAdminNav';
import TenantKitchenClient from './TenantKitchenClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Kitchen Queue' };

export default async function TenantKitchenAdminPage({ params }) {
  let staff;

  try {
    staff = await requireRestaurantStaffAccess(cookies(), params.restaurantSlug);
  } catch (error) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="kitchen" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant-scoped prep queue</p>
          <h2 className="mt-1 text-2xl font-semibold">Kitchen queue</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Track active prep orders for {params.restaurantSlug}. Completed and cancelled orders are excluded by default.
            No payment, messaging, inventory, or recipe workflow is triggered.
          </p>
        </div>
        <TenantKitchenClient restaurantSlug={params.restaurantSlug} staffRole={staff.role} />
      </section>
    </main>
  );
}
