import { getRestaurantStaffFromRequest, RESTAURANT_STAFF_ROLES } from './restaurant-staff-auth';
import { prisma } from './prisma';

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

  const currentStaff = await prisma.restaurantUser.findUnique({
    where: { id: staff.id },
    include: {
      restaurant: {
        select: {
          id: true,
          slug: true,
          status: true,
        },
      },
    },
  });

  if (
    !currentStaff ||
    currentStaff.restaurantId !== staff.restaurantId ||
    !currentStaff.isActive ||
    !isValidCurrentRestaurantStaffRole(currentStaff.role) ||
    !currentStaff.restaurant ||
    currentStaff.restaurant.id !== staff.restaurantId ||
    currentStaff.restaurant.slug !== cleanSlug ||
    currentStaff.restaurant.status === 'ARCHIVED'
  ) {
    const error = new Error('Restaurant staff access is no longer active for this restaurant');
    error.code = 'FORBIDDEN';
    throw error;
  }

  const currentSession = {
    id: currentStaff.id,
    restaurantId: currentStaff.restaurantId,
    restaurantSlug: currentStaff.restaurant.slug,
    email: currentStaff.email,
    role: currentStaff.role,
  };

  if (options.write && !isRestaurantStaffWriteRole(currentSession.role)) {
    const error = new Error('OWNER or MANAGER access is required');
    error.code = 'FORBIDDEN';
    throw error;
  }

  return currentSession;
}

function isValidCurrentRestaurantStaffRole(role) {
  return Object.values(RESTAURANT_STAFF_ROLES).includes(role);
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
