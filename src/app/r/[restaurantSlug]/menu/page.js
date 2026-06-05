export const dynamic = 'force-dynamic';

import Section from '../../../../components/Section';
import MenuClient from '../../../../components/MenuClient';
import { prisma } from '../../../../lib/prisma';
import {
  getTenantContentWhere,
  getTenantRelationWhere,
  getTenantRestaurantContext,
} from '../tenant-route';

export const metadata = {
  title: 'Menu | Restaurant',
};

async function getTenantMenu(context) {
  return prisma.menuCategory.findMany({
    where: getTenantContentWhere(context),
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: getTenantRelationWhere(context),
        orderBy: { name: 'asc' },
      },
    },
  });
}

export default async function TenantMenuPage({ params }) {
  const context = await getTenantRestaurantContext(params);
  const categories = await getTenantMenu(context);
  const hasItems = categories.some((category) => category.items.length > 0);

  return (
    <Section className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          {context.profile.restaurantName}
        </p>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-secondary">
          Our Menu
        </h1>
        <p className="text-sm md:text-base leading-relaxed text-neutral-600">
          {hasItems ? 'Browse available menu items.' : 'Menu content has not been added yet.'}
        </p>
      </div>

      {hasItems ? (
        <MenuClient categories={categories} />
      ) : (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
          <p className="text-lg font-semibold text-amber-950">Menu content has not been added yet.</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-amber-900">
            This tenant has initialized profile/settings, but menu provisioning is still a later platform step.
          </p>
        </div>
      )}
    </Section>
  );
}
