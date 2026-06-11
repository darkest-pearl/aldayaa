import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireRestaurantStaffAccess } from '../../../../../lib/restaurant-staff-access';
import TenantAdminNav from '../TenantAdminNav';
import TenantPurchaseInvoicesClient from './TenantPurchaseInvoicesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Purchase Invoices' };

export default async function TenantPurchaseInvoicesPage({ params }) {
  let staff;

  try {
    staff = await requireRestaurantStaffAccess(cookies(), params.restaurantSlug);
  } catch (error) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="purchase-invoices" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant purchase invoice recording</p>
          <h1 className="mt-1 text-2xl font-semibold">Purchase invoices</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Record supplier invoice details, invoice lines, and optional purchase request references for this restaurant only.
            This does not process payments, send vendors messages, change stock, or create inventory movements.
          </p>
        </div>
        <TenantPurchaseInvoicesClient restaurantSlug={params.restaurantSlug} staffRole={staff.role} />
      </section>
    </main>
  );
}
