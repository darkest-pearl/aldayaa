import { prisma } from './prisma';

export const DEMO_RESTAURANT_SLUG = 'demo-restaurant';
export const DEMO_RESTAURANT_ID = DEMO_RESTAURANT_SLUG;

export const RESTAURANT_STATUSES = Object.freeze([
  'DEMO',
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
]);

const DEFAULT_DEMO_RESTAURANT = Object.freeze({
  id: DEMO_RESTAURANT_ID,
  name: 'Demo Restaurant',
  slug: DEMO_RESTAURANT_SLUG,
  status: 'DEMO',
  type: 'DEMO',
  notes: 'Seeded tenant anchor for the current demo restaurant.',
});

function cleanString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getDemoRestaurantCreateData(overrides = {}) {
  const restaurant = getDemoRestaurantIdentity(overrides);

  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    status: restaurant.status,
    type: restaurant.type,
    notes: restaurant.notes,
  };
}

export function isValidRestaurantStatus(status) {
  return RESTAURANT_STATUSES.includes(status);
}

export function normalizeRestaurant(restaurant = {}) {
  const status = cleanString(restaurant.status, DEFAULT_DEMO_RESTAURANT.status).toUpperCase();

  return {
    id: cleanString(restaurant.id, DEFAULT_DEMO_RESTAURANT.id),
    name: cleanString(restaurant.name, DEFAULT_DEMO_RESTAURANT.name),
    slug: cleanString(restaurant.slug, DEFAULT_DEMO_RESTAURANT.slug),
    status: isValidRestaurantStatus(status) ? status : DEFAULT_DEMO_RESTAURANT.status,
    type: cleanString(restaurant.type, DEFAULT_DEMO_RESTAURANT.type).toUpperCase(),
    notes: cleanString(restaurant.notes, DEFAULT_DEMO_RESTAURANT.notes) || null,
    createdAt: restaurant.createdAt?.toISOString?.() || restaurant.createdAt || null,
    updatedAt: restaurant.updatedAt?.toISOString?.() || restaurant.updatedAt || null,
  };
}

export function getDemoRestaurantIdentity(overrides = {}) {
  return normalizeRestaurant({
    ...DEFAULT_DEMO_RESTAURANT,
    ...overrides,
  });
}

export function getDemoRestaurantId() {
  return DEMO_RESTAURANT_ID;
}

export function getDemoRestaurantWhere() {
  return { id: DEMO_RESTAURANT_ID };
}

export function getRestaurantWhereBySlug(slug) {
  return { slug: cleanString(slug, DEMO_RESTAURANT_SLUG) };
}

export function getDemoRestaurantFilter() {
  return {
    OR: [
      { restaurantId: DEMO_RESTAURANT_ID },
      { restaurantId: null },
    ],
  };
}

export function getDemoRestaurantOrGlobalWhere(extraWhere = {}) {
  return {
    AND: [
      extraWhere,
      getDemoRestaurantFilter(),
    ],
  };
}

export function withDemoRestaurantWhere(extraWhere = {}) {
  return getDemoRestaurantOrGlobalWhere(extraWhere);
}

export function withDemoRestaurantData(data = {}) {
  return {
    ...data,
    restaurantId: DEMO_RESTAURANT_ID,
  };
}

export async function ensureDemoRestaurant() {
  if (!process.env.DATABASE_URL) {
    return getDemoRestaurantIdentity();
  }

  const demoRestaurant = getDemoRestaurantCreateData();

  const restaurant = await prisma.restaurant.upsert({
    where: getDemoRestaurantWhere(),
    update: {
      name: demoRestaurant.name,
      slug: demoRestaurant.slug,
      status: demoRestaurant.status,
      type: demoRestaurant.type,
      notes: demoRestaurant.notes,
    },
    create: demoRestaurant,
  });

  return normalizeRestaurant(restaurant);
}

export async function getCurrentDemoRestaurant({ fallbackOnError = true, ensureExists = false } = {}) {
  if (!process.env.DATABASE_URL) {
    return getDemoRestaurantIdentity();
  }

  try {
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [
          getDemoRestaurantWhere(),
          getRestaurantWhereBySlug(DEMO_RESTAURANT_SLUG),
        ],
      },
    });

    if (restaurant) {
      return normalizeRestaurant(restaurant);
    }

    if (ensureExists) {
      return await ensureDemoRestaurant();
    }

    return getDemoRestaurantIdentity();
  } catch (error) {
    if (!fallbackOnError) {
      throw error;
    }

    console.error('Failed to load demo restaurant tenant identity', error);
    return getDemoRestaurantIdentity();
  }
}
