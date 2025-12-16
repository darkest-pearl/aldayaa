export const dynamic = "force-dynamic";
import Section from '../../../components/Section';
import dynamic from 'next/dynamic';
import { prisma } from '../../../lib/prisma';

export const metadata = {
  title: 'Menu | Al Dayaa Al Shamiah',
};

// Import client component correctly
const MenuClient = dynamic(() => import('../../../components/MenuClient'), {
  ssr: false,
});

async function getMenu() {
  return prisma.menuCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { items: { orderBy: { name: 'asc' } } },
  });
}

export default async function MenuPage() {
  const categories = await getMenu();

  return (
    <Section className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Signature dishes</p>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-secondary">Our Menu</h1>
        <p className="text-sm md:text-base leading-relaxed text-neutral-600">
          Explore our curated selection of Levantine and Indian favorites.
        </p>
      </div>

      {/* Client rendered */}
      <MenuClient categories={categories} />
    </Section>
  );
}
