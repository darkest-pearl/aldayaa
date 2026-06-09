export const dynamic = 'force-dynamic';

import { Prisma } from '@prisma/client';
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

function createStaffManagementError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function ensureActiveOwnerRemainsAfterUpdate(tx, restaurantId) {
  const activeOwnerCount = await tx.restaurantUser.count({
    where: {
      restaurantId,
      role: 'OWNER',
      isActive: true,
    },
  });

  if (activeOwnerCount < 1) {
    throw createStaffManagementError('At least one active OWNER must remain for this restaurant', 400);
  }
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

    const updatedStaffUser = await prisma.$transaction(
      async (tx) => {
        const targetStaffUser = await tx.restaurantUser.findFirst({
          where: {
            id: params.id,
            restaurantId: staff.restaurantId,
          },
          select: staffSelect,
        });

        if (!targetStaffUser) {
          throw createStaffManagementError('Staff user not found', 404);
        }

        if (parsed.data.email && parsed.data.email !== targetStaffUser.email) {
          const duplicateStaffUser = await tx.restaurantUser.findUnique({
            where: {
              restaurantId_email: {
                restaurantId: staff.restaurantId,
                email: parsed.data.email,
              },
            },
            select: { id: true },
          });

          if (duplicateStaffUser && duplicateStaffUser.id !== targetStaffUser.id) {
            throw createStaffManagementError('A staff user with this email already exists for this restaurant', 409);
          }
        }

        const staffUser = await tx.restaurantUser.update({
          where: { id: targetStaffUser.id },
          data,
          select: staffSelect,
        });

        await ensureActiveOwnerRemainsAfterUpdate(tx, staff.restaurantId);

        return staffUser;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return success({ staffUser: normalizeRestaurantStaffUser(updatedStaffUser) });
  } catch (error) {
    return handleApiError(error);
  }
}
