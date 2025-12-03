import { prisma } from './prisma';

const defaultSettings = {
  id: 1,
  openingTime: '08:00',
  closingTime: '23:00',
  allowCancelPaid: false,
  allowCancelInProgress: false,
  cancellationFee: 0,
};

export async function getRestaurantSettings() {
  return prisma.restaurantSettings.upsert({
    where: { id: 1 },
    update: {},
    create: defaultSettings,
  });
}