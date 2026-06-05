import { notFound } from 'next/navigation';
import { prisma } from '../../../lib/prisma';
import { getRestaurantProfile, toPublicRestaurantProfile } from '../../../lib/restaurant-profile';
import { getDisplayHours, getRestaurantSettings } from '../../../lib/restaurant-settings';
import {
  DEMO_RESTAURANT_SLUG,
  getDemoRestaurantFilter,
  getRestaurantBySlug,
  withDemoRestaurantWhere,
} from '../../../lib/restaurants';

export async function getTenantRestaurantProfile(restaurant) {
  if (restaurant.slug === DEMO_RESTAURANT_SLUG) {
    return getRestaurantProfile({ fallbackOnError: false });
  }

  const restaurantId = restaurant.id;
  return prisma.restaurantProfile.findUnique({
    where: { restaurantId },
  });
}

export async function getTenantRestaurantSettings(restaurant) {
  if (restaurant.slug === DEMO_RESTAURANT_SLUG) {
    return getRestaurantSettings();
  }

  const restaurantId = restaurant.id;
  return prisma.restaurantSettings.findUnique({
    where: { restaurantId },
  });
}

export function getTenantContentWhere(context, extraWhere = {}) {
  if (context.isDemoRestaurant) {
    return withDemoRestaurantWhere(extraWhere);
  }

  return {
    ...extraWhere,
    restaurantId: context.restaurant.id,
  };
}

export function getTenantRelationWhere(context, extraWhere = {}) {
  if (context.isDemoRestaurant) {
    return {
      ...extraWhere,
      ...getDemoRestaurantFilter(),
    };
  }

  return {
    ...extraWhere,
    restaurantId: context.restaurant.id,
  };
}

export async function getTenantRestaurantContext(params = {}) {
  const restaurantSlug = typeof params?.restaurantSlug === 'string' ? params.restaurantSlug : '';
  const restaurant = await getRestaurantBySlug(restaurantSlug, { fallbackOnError: false });

  if (!restaurant) {
    notFound();
  }

  const [profileRecord, settingsRecord] = await Promise.all([
    getTenantRestaurantProfile(restaurant),
    getTenantRestaurantSettings(restaurant),
  ]);

  if (!profileRecord || !settingsRecord) {
    notFound();
  }

  return {
    restaurant,
    profile: toPublicRestaurantProfile(profileRecord),
    settings: settingsRecord,
    displayHours: getDisplayHours(settingsRecord),
    isDemoRestaurant: restaurant.slug === DEMO_RESTAURANT_SLUG,
  };
}

export async function requireDemoTenantRestaurant(params = {}) {
  const context = await getTenantRestaurantContext(params);

  if (!context.isDemoRestaurant) {
    notFound();
  }

  return context.restaurant;
}
