export function normalizeRestaurantStaffUser(staffUser = {}) {
  return {
    id: staffUser.id,
    name: staffUser.name || '',
    email: staffUser.email,
    role: staffUser.role,
    isActive: Boolean(staffUser.isActive),
    createdAt: staffUser.createdAt?.toISOString?.() || staffUser.createdAt || null,
    updatedAt: staffUser.updatedAt?.toISOString?.() || staffUser.updatedAt || null,
    lastLoginAt: staffUser.lastLoginAt?.toISOString?.() || staffUser.lastLoginAt || null,
  };
}

export function normalizeRestaurantStaffUsers(staffUsers = []) {
  return staffUsers.map((staffUser) => normalizeRestaurantStaffUser(staffUser));
}
