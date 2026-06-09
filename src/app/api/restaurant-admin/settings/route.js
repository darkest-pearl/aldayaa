export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';
import {
  DAYS_OF_WEEK,
  getDisplayHours,
  normalizeWorkingHoursByDay,
} from '../../../../lib/restaurant-settings';
import {
  getRestaurantSlugFromRequest,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';

const displayHoursSchema = z
  .object({
    weekday: z.string().trim().min(1).optional(),
    friday: z.string().trim().min(1).optional(),
    saturday: z.string().trim().min(1).optional(),
  })
  .optional();

const workingHoursSchema = z.object({
  day: z.enum(DAYS_OF_WEEK),
  openingTime: z.string().trim().min(1),
  closingTime: z.string().trim().min(1),
  closed: z.boolean().optional(),
});

const settingsSchema = z
  .object({
    restaurantSlug: z.string().trim().min(1),
    openingTime: z.string().trim().min(1),
    closingTime: z.string().trim().min(1),
    allowCancelPaid: z.boolean().optional(),
    allowCancelInProgress: z.boolean().optional(),
    cancellationFee: z.number().min(0).optional(),
    workingHoursByDay: z.array(workingHoursSchema).optional(),
    displayHours: displayHoursSchema,
  })
  .superRefine((data, ctx) => {
    if (!data.workingHoursByDay) return;
    const seen = new Set();
    data.workingHoursByDay.forEach((entry, index) => {
      if (seen.has(entry.day)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate day provided for ${entry.day}`,
          path: ['workingHoursByDay', index, 'day'],
        });
      }
      seen.add(entry.day);
    });
  });

function normalizeTenantSettings(settings) {
  const workingHoursByDay = normalizeWorkingHoursByDay(
    settings.workingHoursByDay,
    settings.openingTime,
    settings.closingTime,
  );

  return {
    ...settings,
    workingHoursByDay,
    displayHours: getDisplayHours(settings),
  };
}

async function loadTenantSettings(staff) {
  return prisma.restaurantSettings.findUnique({
    where: { restaurantId: staff.restaurantId },
  });
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const settings = await loadTenantSettings(staff);

    if (!settings) {
      return failure('Restaurant settings are not initialized for this tenant', 404);
    }

    return success({
      settings: normalizeTenantSettings(settings),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const parsed = settingsSchema.safeParse({
      ...body,
      cancellationFee: Number(body.cancellationFee ?? 0),
    });
    if (!parsed.success) {
      return failure('Invalid restaurant settings payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existingSettings = await loadTenantSettings(staff);

    if (!existingSettings) {
      return failure('Restaurant settings are not initialized for this tenant', 404);
    }

    const normalizedWorkingHours = normalizeWorkingHoursByDay(
      parsed.data.workingHoursByDay,
      parsed.data.openingTime,
      parsed.data.closingTime,
    );

    const fallbackDisplayHours = getDisplayHours(existingSettings);
    const nextDisplayHours = parsed.data.displayHours
      ? {
          weekday: parsed.data.displayHours.weekday?.trim() || fallbackDisplayHours.weekday,
          friday: parsed.data.displayHours.friday?.trim() || fallbackDisplayHours.friday,
          saturday: parsed.data.displayHours.saturday?.trim() || fallbackDisplayHours.saturday,
        }
      : fallbackDisplayHours;

    const settings = await prisma.restaurantSettings.update({
      where: { restaurantId: staff.restaurantId },
      data: {
        openingTime: parsed.data.openingTime,
        closingTime: parsed.data.closingTime,
        allowCancelPaid: Boolean(parsed.data.allowCancelPaid),
        allowCancelInProgress: Boolean(parsed.data.allowCancelInProgress),
        cancellationFee: parsed.data.cancellationFee ?? 0,
        workingHoursByDay: JSON.stringify(normalizedWorkingHours),
        displayHours: JSON.stringify(nextDisplayHours),
      },
    });

    return success({ settings: normalizeTenantSettings(settings) });
  } catch (error) {
    return handleApiError(error);
  }
}
