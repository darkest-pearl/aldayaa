import Section from '../../../components/Section';
import GalleryClient from '../../../components/GalleryClient';
import { prisma } from '../../../lib/prisma';

export const metadata = { title: 'Gallery | Al Dayaa Al Shamiah' };

async function getGallery() {
  return prisma.galleryCategory.findMany({ include: { photos: true }, orderBy: { name: 'asc' } });
}

export default async function GalleryPage() {
  const categories = await getGallery();
  return (
    <Section>
      <div className="mb-5 md:mb-6 text-center">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2">Gallery</h1>
        <p className="text-sm md:text-base text-textdark/70">Food, interiors, and vibrant nights at Al Dayaa.</p>
      </div>
      <GalleryClient categories={categories} />
    </Section>
  );
}