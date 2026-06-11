import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireRestaurantStaffAccess } from '../../../../../lib/restaurant-staff-access';
import TenantAdminNav from '../TenantAdminNav';
import TenantRecipesClient from './TenantRecipesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tenant Recipes' };

export default async function TenantRecipesPage({ params }) {
  let staff;

  try {
    staff = await requireRestaurantStaffAccess(cookies(), params.restaurantSlug);
  } catch (error) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="recipes" staff={staff} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Tenant recipes</p>
          <h1 className="mt-1 text-2xl font-semibold">Recipe and ingredient linkage</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Link this restaurant's menu items to inventory ingredients for recipe visibility. This foundation does not
            deduct stock, create inventory movements, or connect recipes to orders automatically.
          </p>
        </div>
        <TenantRecipesClient restaurantSlug={params.restaurantSlug} staffRole={staff.role} />
      </section>
    </main>
  );
}
