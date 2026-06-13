import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireRestaurantStaffAccess } from '../../../../../lib/restaurant-staff-access';
import TenantAdminNav from '../TenantAdminNav';
import TenantReportsClient from './TenantReportsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Operations Reports' };

export default async function TenantReportsPage({ params }) {
  let staff;

  try {
    staff = await requireRestaurantStaffAccess(cookies(), params.restaurantSlug);
  } catch (error) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="reports" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant operations reporting</p>
          <h1 className="mt-1 text-2xl font-semibold">Reports</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Review scoped operational summaries for this restaurant. SUPPORT can view reports, and reporting is
            read-only with no automation or write workflow attached.
          </p>
        </div>
        <TenantReportsClient restaurantSlug={params.restaurantSlug} staffRole={staff.role} />
      </section>
    </main>
  );
}
