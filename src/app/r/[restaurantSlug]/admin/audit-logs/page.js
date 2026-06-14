import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  isRestaurantStaffWriteRole,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';
import TenantAdminNav from '../TenantAdminNav';
import TenantAuditLogsClient from './TenantAuditLogsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Audit Logs' };

export default async function TenantAuditLogsPage({ params }) {
  let staff;

  try {
    staff = await requireRestaurantStaffAccess(cookies(), params.restaurantSlug);
  } catch (error) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  const canViewAuditLogs = isRestaurantStaffWriteRole(staff.role);

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="audit-logs" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant security history</p>
          <h1 className="mt-1 text-2xl font-semibold">Audit logs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Review tenant-scoped staff admin activity for this restaurant. Audit logs are read-only and do not connect
            to external logging, SIEM, alerting, email, or WhatsApp workflows.
          </p>
        </div>
        {canViewAuditLogs ? (
          <TenantAuditLogsClient restaurantSlug={params.restaurantSlug} />
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            OWNER or MANAGER access is required to view tenant audit logs.
          </div>
        )}
      </section>
    </main>
  );
}
