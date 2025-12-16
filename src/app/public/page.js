export const dynamic = "force-dynamic";

import HomeClient from './HomeClient';
import { prisma } from '../../lib/prisma';

async function getSignatureDishes() {
  const dishes = await prisma.menuItem.findMany({
    where: { isSignature: true },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      imageUrl: true,
    },
  });

  const shuffled = [...dishes].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4);
}

export default async function HomePage() {
  const signatureDishes = await getSignatureDishes();

      return <HomeClient signatureDishes={signatureDishes} />;
}
