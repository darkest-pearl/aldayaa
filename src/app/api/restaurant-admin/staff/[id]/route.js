export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import { normalizeRestaurantStaffUser } from '../../../../../lib/restaurant-staff-management';
import {
  normalizeOptionalText,
  requireRestaurantStaffOwnerAccess,
} from '../../../../../lib/restaurant-staff-access';
import {
  RESTAURANT_STAFF_ROLE_VALUES,
  hashRestaurantStaffPassword,
  normalizeRestaurantStaffEmail,
} from '../../../../../lib/restaurant-staff-auth';

const updateStaffSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  name: z.string().trim().optional().nullable(),
  email: z.string().email().optional(),
  role: z.enum(RESTAURANT_STAFF_ROLE_VALUES).optional(),
  isActive: z.boolean().optional(),
  password: z
    .string()
    .trim()
    .optional()
    .refine((value) => value === undefined || value === '' || value.length >= 10, {
      message: 'Password must be at least 10 characters when provided',
    }),
});

const staffSelect = {
  id: true,
  restaurantId: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
};

async function ensureCanChangeOwnerStatus(staff, targetStaffUser, nextRole, nextIsActive) {
  const activeOwnerWouldChange =
    targetStaffUser.role === 'OWNER' &&
    targetStaffUser.isActive &&
    (nextRole !== 'OWNER' || nextIsActive === false);

  if (!activeOwnerWouldChange) return null;

  const activeOwnerCount = await prisma.restaurantUser.count({
    where: {
      restaurantId: staff.restaurantId,
      role: 'OWNER',
      isActive: true,
    },
  });

  if (activeOwnerCount <= 1) {
    return failure('At least one active OWNER must remain for this restaurant', 400);
  }

  return null;
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = updateStaffSchema.safeParse({
      ...body,
      email: Object.prototype.hasOwnProperty.call(body, 'email')
        ? normalizeRestaurantStaffEmail(body.email)
        : undefined,
    });
    if (!parsed.success) {
      return failure('Invalid staff update payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffOwnerAccess(request, parsed.data.restaurantSlug);
    const targetStaffUser = await prisma.restaurantUser.findFirst({
      where: {
        id: params.id,
        restaurantId: staff.restaurantId,
      },
      select: staffSelect,
    });

    if (!targetStaffUser) {
      return failure('Staff user not found', 404);
    }

    if (parsed.data.email && parsed.data.email !== targetStaffUser.email) {
      const duplicateStaffUser = await prisma.restaurantUser.findUnique({
        where: {
          restaurantId_email: {
            restaurantId: staff.restaurantId,
            email: parsed.data.email,
          },
        },
        select: { id: true },
      });

      if (duplicateStaffUser && duplicateStaffUser.id !== targetStaffUser.id) {
        return failure('A staff user with this email already exists for this restaurant', 409);
      }
    }

    const nextRole = parsed.data.role || targetStaffUser.role;
    const nextIsActive = parsed.data.isActive ?? targetStaffUser.isActive;
    const ownerProtectionFailure = await ensureCanChangeOwnerStatus(
      staff,
      targetStaffUser,
      nextRole,
      nextIsActive,
    );

    if (ownerProtectionFailure) {
      return ownerProtectionFailure;
    }

    const data = {};
    if (Object.prototype.hasOwnProperty.call(parsed.data, 'name')) {
      data.name = normalizeOptionalText(parsed.data.name);
    }
    if (parsed.data.email) {
      data.email = parsed.data.email;
    }
    if (parsed.data.role) {
      data.role = parsed.data.role;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, 'isActive')) {
      data.isActive = Boolean(parsed.data.isActive);
    }
    if (parsed.data.password) {
      data.passwordHash = await hashRestaurantStaffPassword(parsed.data.password);
    }

    const updatedStaffUser = await prisma.restaurantUser.update({
      where: { id: targetStaffUser.id },
      data,
      select: staffSelect,
    });

    return success({ staffUser: normalizeRestaurantStaffUser(updatedStaffUser) });
  } catch (error) {
    return handleApiError(error);
  }
}
