import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireRestaurantStaffAccess } from '../../../../../lib/restaurant-staff-access';
import TenantAdminNav from '../TenantAdminNav';
import TenantPurchaseRequestsClient from './TenantPurchaseRequestsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Purchase Requests' };

export default async function TenantPurchaseRequestsPage({ params }) {
  let staff;

  try {
    staff = await requireRestaurantStaffAccess(cookies(), params.restaurantSlug);
  } catch (error) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="purchase-requests" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant inventory replenishment</p>
          <h1 className="mt-1 text-2xl font-semibold">Purchase requests</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Create manual purchase requests from tenant inventory items, track request status, and receive stock when
            the goods arrive. Receiving uses full purchase request lines only, increases inventory, and records
            inventory movements; it does not send requests to suppliers, create invoices, or process payments.
          </p>
        </div>
        <TenantPurchaseRequestsClient restaurantSlug={params.restaurantSlug} staffRole={staff.role} />
      </section>
    </main>
  );
}
