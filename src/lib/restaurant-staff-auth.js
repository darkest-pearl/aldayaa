export const RESTAURANT_STAFF_COOKIE_NAME = 'aldayaa_restaurant_staff';

export const RESTAURANT_STAFF_ROLES = Object.freeze({
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  SUPPORT: 'SUPPORT',
});

export const RESTAURANT_STAFF_ROLE_VALUES = Object.freeze(Object.values(RESTAURANT_STAFF_ROLES));

export function isValidRestaurantStaffRole(role) {
  return RESTAURANT_STAFF_ROLE_VALUES.includes(role);
}

export function createRestaurantStaffTokenPayload(staffUser) {
  if (!staffUser?.id || !staffUser?.restaurantId || !staffUser?.email || !staffUser?.role) {
    throw new Error('Invalid restaurant staff payload');
  }

  if (!isValidRestaurantStaffRole(staffUser.role)) {
    throw new Error('Invalid restaurant staff payload');
  }

  return {
    id: staffUser.id,
    restaurantId: staffUser.restaurantId,
    email: staffUser.email,
    role: staffUser.role,
  };
}
