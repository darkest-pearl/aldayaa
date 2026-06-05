export const dynamic = 'force-dynamic';

import PublicOrderPage from '../../../public/order/page';
import Section from '../../../../components/Section';
import { prisma } from '../../../../lib/prisma';
import {
  getTenantContentWhere,
  getTenantRelationWhere,
  getTenantRestaurantContext,
} from '../tenant-route';

export const metadata = {
  title: 'Order Online | Restaurant',
};

async function getTenantMenuItemCount(context) {
  const categories = await prisma.menuCategory.findMany({
    where: getTenantContentWhere(context),
    include: {
      items: {
        where: getTenantRelationWhere(context, { isAvailable: true }),
        select: { id: true },
      },
    },
  });

  return categories.reduce((total, category) => total + category.items.length, 0);
}

export default async function TenantOrderPage({ params, searchParams = {} }) {
  const context = await getTenantRestaurantContext(params);

  if (context.isDemoRestaurant) {
    return <PublicOrderPage searchParams={searchParams} />;
  }

  const menuItemCount = await getTenantMenuItemCount(context);

  return (
    <Section className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          {context.profile.restaurantName}
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold mb-1 text-secondary">Order Online</h1>
        <p className="text-sm md:text-base text-neutral-600">
          Online ordering is not available yet for this restaurant.
        </p>
      </div>

      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
        <p className="text-lg font-semibold text-amber-950">ordering is not available yet</p>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          {menuItemCount > 0
            ? 'Menu items exist, but tenant-aware checkout APIs are still a later platform step.'
            : 'Menu content has not been added yet, so checkout is disabled for this tenant.'}
        </p>
      </div>
    </Section>
  );
}
