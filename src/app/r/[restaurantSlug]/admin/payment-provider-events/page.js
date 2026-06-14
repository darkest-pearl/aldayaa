import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  isRestaurantStaffWriteRole,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';
import TenantAdminNav from '../TenantAdminNav';
import TenantPaymentProviderEventsClient from './TenantPaymentProviderEventsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Payment Provider Events' };

export default async function TenantPaymentProviderEventsPage({ params }) {
  let staff;

  try {
    staff = await requireRestaurantStaffAccess(cookies(), params.restaurantSlug);
  } catch (error) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  const canViewPaymentEvents = isRestaurantStaffWriteRole(staff.role);

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="payment-provider-events" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant payment event foundation</p>
          <h1 className="mt-1 text-2xl font-semibold">Payment events</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Review sanitized provider event idempotency records scoped to this tenant. Provider event tracking is a
            foundation only; no webhook endpoint is active and no real payment processing occurs.
          </p>
        </div>
        {canViewPaymentEvents ? (
          <TenantPaymentProviderEventsClient restaurantSlug={params.restaurantSlug} />
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            OWNER or MANAGER access is required to view payment provider events.
          </div>
        )}
      </section>
    </main>
  );
}
