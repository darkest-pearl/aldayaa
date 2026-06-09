export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';
import { normalizeRestaurantStaffUsers } from '../../../../lib/restaurant-staff-management';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
  requireRestaurantStaffOwnerAccess,
} from '../../../../lib/restaurant-staff-access';
import {
  RESTAURANT_STAFF_ROLE_VALUES,
  hashRestaurantStaffPassword,
  normalizeRestaurantStaffEmail,
} from '../../../../lib/restaurant-staff-auth';

const createStaffSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  name: z.string().trim().optional().nullable(),
  email: z.string().email(),
  password: z.string().min(10),
  role: z.enum(RESTAURANT_STAFF_ROLE_VALUES),
});

const staffSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
};

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const [staffUsers, activeOwnerCount] = await Promise.all([
      prisma.restaurantUser.findMany({
        where: { restaurantId: staff.restaurantId },
        select: staffSelect,
        orderBy: [{ role: 'asc' }, { email: 'asc' }],
      }),
      prisma.restaurantUser.count({
        where: {
          restaurantId: staff.restaurantId,
          role: 'OWNER',
          isActive: true,
        },
      }),
    ]);

    return success({
      staffUsers: normalizeRestaurantStaffUsers(staffUsers),
      activeOwnerCount,
      currentStaffId: staff.id,
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = createStaffSchema.safeParse({
      ...body,
      email: normalizeRestaurantStaffEmail(body?.email),
    });
    if (!parsed.success) {
      return failure('Invalid staff payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffOwnerAccess(request, parsed.data.restaurantSlug);
    const existingStaffUser = await prisma.restaurantUser.findUnique({
      where: {
        restaurantId_email: {
          restaurantId: staff.restaurantId,
          email: parsed.data.email,
        },
      },
      select: { id: true },
    });

    if (existingStaffUser) {
      return failure('A staff user with this email already exists for this restaurant', 409);
    }

    const passwordHash = await hashRestaurantStaffPassword(parsed.data.password);
    const staffUser = await prisma.restaurantUser.create({
      data: {
        restaurantId: staff.restaurantId,
        name: normalizeOptionalText(parsed.data.name),
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role,
        isActive: true,
      },
      select: staffSelect,
    });

    return success({ staffUser: normalizeRestaurantStaffUsers([staffUser])[0] });
  } catch (error) {
    return handleApiError(error);
  }
}
