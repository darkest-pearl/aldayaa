import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireRestaurantStaffAccess } from '../../../../../lib/restaurant-staff-access';
import TenantAdminNav from '../TenantAdminNav';
import TenantPaymentSettingsClient from './TenantPaymentSettingsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Payment Settings' };

export default async function TenantPaymentSettingsPage({ params }) {
  let staff;

  try {
    staff = await requireRestaurantStaffAccess(cookies(), params.restaurantSlug);
  } catch (error) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="payment-settings" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Provider readiness</p>
          <h1 className="mt-1 text-2xl font-semibold">Payment settings</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Plan tenant payment provider readiness without enabling real payment processing. Provider secrets stay in the
            hosting provider or approved secret manager, not in the database.
          </p>
        </div>
        <TenantPaymentSettingsClient restaurantSlug={params.restaurantSlug} staffRole={staff.role} />
      </section>
    </main>
  );
}
