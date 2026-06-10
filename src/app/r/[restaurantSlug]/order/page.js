export const dynamic = 'force-dynamic';

import PublicOrderPage from '../../../public/order/page';
import Section from '../../../../components/Section';
import OrderClient from '../../../../components/OrderClient';
import { FEATURE_KEYS, isFeatureEnabled } from '../../../../lib/features';
import { prisma } from '../../../../lib/prisma';
import {
  getTenantContentWhere,
  getTenantRelationWhere,
  getTenantRestaurantContext,
} from '../tenant-route';

export const metadata = {
  title: 'Order Online | Restaurant',
};

async function getTenantMenu(context) {
  return prisma.menuCategory.findMany({
    where: getTenantContentWhere(context),
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: getTenantRelationWhere(context, { isAvailable: true }),
      },
    },
  });
}

function getTenantMenuItemCount(categories) {
  return categories.reduce((total, category) => total + category.items.length, 0);
}

export default async function TenantOrderPage({ params, searchParams = {} }) {
  const context = await getTenantRestaurantContext(params);

  if (context.isDemoRestaurant) {
    return <PublicOrderPage searchParams={searchParams} />;
  }

  const tableSlug = typeof searchParams.table === 'string' ? searchParams.table : '';
  const tableToken = typeof searchParams.tableToken === 'string' ? searchParams.tableToken : '';
  const hasTableContextRequest = Boolean(tableSlug || tableToken);
  const categories = JSON.parse(JSON.stringify(await getTenantMenu(context)));
  const menuItemCount = getTenantMenuItemCount(categories);
  const onlineOrderingEnabled = isFeatureEnabled(context.profile.enabledFeatures, FEATURE_KEYS.ONLINE_ORDERING);
  const orderingUnavailable =
    context.restaurant.status === 'ARCHIVED' ||
    !onlineOrderingEnabled ||
    hasTableContextRequest ||
    menuItemCount === 0;

  return (
    <Section className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          {context.profile.restaurantName}
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold mb-1 text-secondary">Order Online</h1>
        <p className="text-sm md:text-base text-neutral-600">
          {orderingUnavailable
            ? 'Online ordering is not available yet for this restaurant.'
            : 'Add your favorites to the cart and send your order directly to this restaurant.'}
        </p>
      </div>

      {orderingUnavailable ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
          <p className="text-lg font-semibold text-amber-950">ordering is not available yet</p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            {hasTableContextRequest
              ? 'Table ordering is not available yet for this restaurant.'
              : menuItemCount > 0
                ? 'Online ordering must be enabled for this tenant before checkout can accept orders.'
                : 'Menu content has not been added yet, so checkout is disabled for this tenant.'}
          </p>
        </div>
      ) : (
        <OrderClient
          categories={categories}
          restaurantSlug={context.restaurant.slug}
          enableReadyNotification={false}
          showOrderSupportActions={false}
        />
      )}
    </Section>
  );
}
