export const dynamic = "force-dynamic";

import HomeClient from './HomeClient';
import { prisma } from '../../lib/prisma';

async function getRecommendedDishes() {
  const dishes = await prisma.menuItem.findMany({
    where: { recommended: true },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      imageUrl: true,
    },
  });

  return dishes.sort(() => Math.random() - 0.5).slice(0, 6);
}

export default async function HomePage() {
  const recommendedDishes = await getRecommendedDishes();

      return <HomeClient recommendedDishes={recommendedDishes} />;
}
