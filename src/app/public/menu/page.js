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
    <Section>
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-semibold mb-2">Our Menu</h1>
        <p className="text-textdark/70">
          Explore our curated selection of Levantine and Indian favorites.
        </p>
      </div>

      {/* Client rendered */}
      <MenuClient categories={categories} />
    </Section>
  );
}
