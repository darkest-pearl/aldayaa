export const DEMO_RESTAURANT_SLUG = 'demo-restaurant';

export const RESTAURANT_STATUSES = Object.freeze([
  'DEMO',
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
]);

const DEFAULT_DEMO_RESTAURANT = Object.freeze({
  id: DEMO_RESTAURANT_SLUG,
  name: 'Demo Restaurant',
  slug: DEMO_RESTAURANT_SLUG,
  status: 'DEMO',
  type: 'DEMO',
  notes: 'Seeded tenant anchor for the current demo restaurant.',
});

function cleanString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
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
