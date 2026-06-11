import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireRestaurantStaffAccess } from '../../../../../lib/restaurant-staff-access';
import TenantAdminNav from '../TenantAdminNav';
import TenantSuppliersClient from './TenantSuppliersClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Suppliers' };

export default async function TenantSuppliersPage({ params }) {
  let staff;

  try {
    staff = await requireRestaurantStaffAccess(cookies(), params.restaurantSlug);
  } catch (error) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="suppliers" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant supplier records</p>
          <h1 className="mt-1 text-2xl font-semibold">Suppliers</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Manage vendor contact records for this restaurant only. This foundation does not send email, WhatsApp,
            invoices, payments, or automated supplier requests.
          </p>
        </div>
        <TenantSuppliersClient restaurantSlug={params.restaurantSlug} staffRole={staff.role} />
      </section>
    </main>
  );
}
