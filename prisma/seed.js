import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.galleryCategory.deleteMany();
  await prisma.adminUser.deleteMany();

  const categories = await prisma.menuCategory.createMany({
    data: [
      { name: 'Starters & Mezzes', description: 'Warm breads and classic dips', sortOrder: 1 },
      { name: 'Salads', description: 'Fresh seasonal greens', sortOrder: 2 },
      { name: 'Grills & Mains', description: 'Charcoal grilled meats', sortOrder: 3 },
      { name: 'Sandwiches / Wraps', description: 'Handheld favorites', sortOrder: 4 },
      { name: 'Desserts', description: 'Sweet endings', sortOrder: 5 },
      { name: 'Drinks & Fresh Juices', description: 'Refreshing sips', sortOrder: 6 }
    ]
  });

  const cats = await prisma.menuCategory.findMany();
  const catMap = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  await prisma.menuItem.createMany({
    data: [
      { name: 'Hummus Bil Tahina', description: 'Creamy chickpea dip with olive oil.', price: 18, categoryId: catMap['Starters & Mezzes'], recommended: true },
      { name: 'Tabbouleh', description: 'Parsley salad with bulgur, tomatoes, lemon.', price: 20, categoryId: catMap['Salads'] },
      { name: 'Mixed Grill', description: 'Kebab, shish tawook, lamb chop platter.', price: 65, categoryId: catMap['Grills & Mains'], recommended: true },
      { name: 'Chicken Shawarma Wrap', description: 'Garlic sauce, pickles, fries.', price: 22, categoryId: catMap['Sandwiches / Wraps'] },
      { name: 'Kunafa', description: 'Warm cheese pastry with syrup.', price: 24, categoryId: catMap['Desserts'] },
      { name: 'Fresh Lemon Mint', description: 'Cooling citrus and mint blend.', price: 16, categoryId: catMap['Drinks & Fresh Juices'] }
    ]
  });

  const galleryCats = await prisma.galleryCategory.createMany({ data: [
    { name: 'Food' },
    { name: 'Interior' },
    { name: 'Events & Vibes' }
  ]});
  const gCats = await prisma.galleryCategory.findMany();
  const gMap = Object.fromEntries(gCats.map((c) => [c.name, c.id]));

  await prisma.photo.createMany({
    data: [
      { title: 'Grill Flames', description: 'Smoky grills in action.', imageUrl: '/images/food-grill.jpg', categoryId: gMap['Food'] },
      { title: 'Colorful Mezze', description: 'Spread of mezze favorites.', imageUrl: '/images/food-mezze.jpg', categoryId: gMap['Food'] },
      { title: 'Dining Room', description: 'Cozy interior seating.', imageUrl: '/images/interior-1.jpg', categoryId: gMap['Interior'] },
      { title: 'Family Time', description: 'Families dining together.', imageUrl: '/images/vibes-family.jpg', categoryId: gMap['Events & Vibes'] }
    ]
  });

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await prisma.adminUser.create({ data: { email: process.env.ADMIN_EMAIL, passwordHash: hash } });
  }

  console.log('Database seeded');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });