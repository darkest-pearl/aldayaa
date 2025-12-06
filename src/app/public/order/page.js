import Section from '../../../components/Section';
import OrderClient from '../../../components/OrderClient';
import { prisma } from '../../../lib/prisma';

export const metadata = {
  title: 'Order Online | Al Dayaa Al Shamiah'
};

async function getMenu() {
  return prisma.menuCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { items: true },
  });
}

export default async function OrderPage() {
  const categories = JSON.parse(JSON.stringify(await getMenu()));

  return (
    <Section className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Seamless ordering</p>
        <h1 className="text-2xl md:text-3xl font-semibold mb-1 text-secondary">Order for Delivery or Pickup</h1>
        <p className="text-sm md:text-base text-neutral-600">
          Add your favorites to the cart and we will confirm via WhatsApp.
        </p>
      </div>

      <OrderClient categories={categories} />
    </Section>
  );
}
