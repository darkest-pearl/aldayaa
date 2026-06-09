import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRestaurantStaffFromRequest } from '../../../../../lib/restaurant-staff-auth';
import TenantAdminNav from '../TenantAdminNav';
import TenantReservationsClient from './TenantReservationsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Reservations Admin' };

export default async function TenantReservationsAdminPage({ params }) {
  const staff = await getRestaurantStaffFromRequest(cookies());

  if (!staff || staff.restaurantSlug !== params.restaurantSlug) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="reservations" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant-scoped operations</p>
          <h2 className="mt-1 text-2xl font-semibold">Reservations</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            View bookings and update reservation status for {params.restaurantSlug}. This does not create orders,
            activate payments, or send messages.
          </p>
        </div>
        <TenantReservationsClient restaurantSlug={params.restaurantSlug} staffRole={staff.role} />
      </section>
    </main>
  );
}
