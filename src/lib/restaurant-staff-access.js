import { getRestaurantStaffFromRequest, RESTAURANT_STAFF_ROLES } from './restaurant-staff-auth';

export const RESTAURANT_STAFF_WRITE_ROLES = Object.freeze([
  RESTAURANT_STAFF_ROLES.OWNER,
  RESTAURANT_STAFF_ROLES.MANAGER,
]);

export function isRestaurantStaffWriteRole(role) {
  return RESTAURANT_STAFF_WRITE_ROLES.includes(role);
}

export async function requireRestaurantStaffAccess(request, restaurantSlug, options = {}) {
  const staff = await getRestaurantStaffFromRequest(request);
  const cleanSlug = typeof restaurantSlug === 'string' ? restaurantSlug.trim() : '';

  if (!staff) {
    const error = new Error('Restaurant staff login required');
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  if (!cleanSlug || staff.restaurantSlug !== cleanSlug) {
    const error = new Error('Restaurant staff session does not match this restaurant');
    error.code = 'FORBIDDEN';
    throw error;
  }

  if (options.write && !isRestaurantStaffWriteRole(staff.role)) {
    const error = new Error('OWNER or MANAGER access is required');
    error.code = 'FORBIDDEN';
    throw error;
  }

  return staff;
}

export function getRestaurantSlugFromRequest(request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get('restaurantSlug') || '';
}

export function normalizeOptionalText(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned || null;
}

export function normalizeRequiredText(value) {
  return typeof value === 'string' ? value.trim() : '';
}
