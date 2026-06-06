export const dynamic = 'force-dynamic';

import Section from '../../../../components/Section';
import GalleryClient from '../../../../components/GalleryClient';
import { prisma } from '../../../../lib/prisma';
import {
  getTenantContentWhere,
  getTenantRelationWhere,
  getTenantRestaurantContext,
} from '../tenant-route';

export const metadata = { title: 'Gallery | Restaurant' };

async function getTenantGallery(context) {
  return prisma.galleryCategory.findMany({
    where: getTenantContentWhere(context),
    include: {
      photos: {
        where: getTenantRelationWhere(context),
      },
    },
    orderBy: { name: 'asc' },
  });
}

export default async function TenantGalleryPage({ params }) {
  const context = await getTenantRestaurantContext(params);
  const categories = await getTenantGallery(context);
  const hasPhotos = categories.some((category) => category.photos.length > 0);

  return (
    <Section>
      <div className="mb-5 md:mb-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          {context.profile.restaurantName}
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold mb-2">Gallery</h1>
        <p className="text-sm md:text-base text-textdark/70">
          {hasPhotos ? 'Browse this restaurant gallery.' : 'Gallery content has not been added yet.'}
        </p>
      </div>

      {hasPhotos ? (
        <GalleryClient categories={categories} />
      ) : (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
          <p className="text-lg font-semibold text-amber-950">Gallery content has not been added yet.</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-amber-900">
            This tenant has initialized profile/settings, but gallery provisioning is still a later platform step.
          </p>
        </div>
      )}
    </Section>
  );
}
