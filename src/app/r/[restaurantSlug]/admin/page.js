import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRestaurantStaffFromRequest } from '../../../../lib/restaurant-staff-auth';
import TenantAdminNav from './TenantAdminNav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Restaurant Staff Admin' };

export default async function TenantRestaurantAdminPage({ params }) {
  const staff = await getRestaurantStaffFromRequest(cookies());

  if (!staff || staff.restaurantSlug !== params.restaurantSlug) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="overview" staff={staff} />
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950 md:col-span-2">
          <span className="font-semibold">Restaurant staff access is active.</span> Tenant-scoped menu, gallery, profile, settings, staff management, reservations, and tables are available now.
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Menu management</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Manage categories, dishes, pricing, availability, recommendations, signature items, and image URLs for this tenant only.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/menu`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open menu
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Gallery management</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Manage gallery categories and photo metadata for this tenant. Upload storage remains a future enhancement.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/gallery`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open gallery
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Profile and settings</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Manage public profile metadata, contact links, brand colors, display hours, and cancellation settings for this tenant only.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/settings`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open settings
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Staff management</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            OWNER users can create, update, deactivate, and manually reset passwords for RestaurantUser records in this tenant only.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/staff`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open staff
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Reservations</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            View bookings and update reservation status for this tenant only. No messaging, ordering, or payment workflow is triggered.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/reservations`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open reservations
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Tables</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Create and manage table labels, zones, seats, active state, and QR token references for this tenant only. This does not activate tenant table ordering.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/tables`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open tables
          </a>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 md:col-span-2">
          Orders, tenant table ordering activation, inventory, recipes, advanced staff workflows, billing, domains, email, and WhatsApp automation remain future tenant admin work.
        </div>
      </section>
    </main>
  );
}
