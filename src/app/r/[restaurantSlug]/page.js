export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Section from '../../../components/Section';
import { prisma } from '../../../lib/prisma';
import { getTenantContentWhere, getTenantRestaurantContext } from './tenant-route';

async function getTenantHomeSummary(context) {
  const [recommendedDishes, galleryPhotosCount] = await Promise.all([
    prisma.menuItem.findMany({
      where: getTenantContentWhere(context, { recommended: true }),
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
      },
      take: 6,
    }),
    prisma.photo.count({
      where: getTenantContentWhere(context),
    }),
  ]);

  return { recommendedDishes, galleryPhotosCount };
}

export default async function TenantHomePage({ params }) {
  const context = await getTenantRestaurantContext(params);
  const { recommendedDishes, galleryPhotosCount } = await getTenantHomeSummary(context);
  const hasMenuContent = recommendedDishes.length > 0;
  const hasGalleryContent = galleryPhotosCount > 0;
  const basePath = `/r/${context.restaurant.slug}`;

  return (
    <div className="bg-[#f6f0e7] text-textdark">
      <section className="bg-neutral-950 text-white">
        <Section className="py-12 md:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            {context.isDemoRestaurant ? 'Demo tenant' : 'Initialized tenant'}
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">
            {context.profile.restaurantName}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/75 md:text-lg">
            {context.profile.tagline}
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href={`${basePath}/menu`} className="rounded-full bg-amber-400 px-5 py-3 font-semibold text-neutral-950">
              View menu
            </Link>
            <Link href={`${basePath}/gallery`} className="rounded-full border border-white/25 px-5 py-3 font-semibold text-white">
              View gallery
            </Link>
          </div>
        </Section>
      </section>

      <Section className="space-y-8">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Cuisine</p>
            <p className="mt-2 text-lg font-semibold text-secondary">{context.profile.cuisineType}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Contact</p>
            <p className="mt-2 text-lg font-semibold text-secondary">{context.profile.whatsappNumber}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Address</p>
            <p className="mt-2 text-sm leading-6 text-neutral-700">{context.profile.address}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-secondary">Menu</h2>
            {hasMenuContent ? (
              <ul className="mt-4 space-y-3">
                {recommendedDishes.map((dish) => (
                  <li key={dish.id} className="flex justify-between gap-4 border-b border-neutral-100 pb-3 text-sm">
                    <span className="font-semibold text-neutral-900">{dish.name}</span>
                    <span className="text-neutral-600">AED {dish.price.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-neutral-600">Menu content has not been added yet.</p>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-secondary">Gallery</h2>
            {hasGalleryContent ? (
              <p className="mt-3 text-sm leading-6 text-neutral-600">
                Gallery content is available. Open the gallery page to browse photos.
              </p>
            ) : (
              <p className="mt-3 text-sm leading-6 text-neutral-600">Gallery content has not been added yet.</p>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
