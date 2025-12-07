export const dynamic = "force-dynamic";
import { z } from 'zod';
import { requireAdmin } from '../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';
import {
  DAYS_OF_WEEK,
  getDisplayHours,
  getRestaurantSettings,
  normalizeWorkingHoursByDay,
} from '../../../../lib/restaurant-settings';

const displayHoursSchema = z
  .object({
    weekday: z.string().min(1).optional(),
    friday: z.string().min(1).optional(),
    saturday: z.string().min(1).optional(),
  })
  .optional();
  
  const workingHoursSchema = z.object({
  day: z.enum(DAYS_OF_WEEK),
  openingTime: z.string().min(1),
  closingTime: z.string().min(1),
  closed: z.boolean().optional(),
});

const settingsSchema = z
  .object({
    openingTime: z.string().min(1),
    closingTime: z.string().min(1),
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
  
export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN']);
    const settings = await getRestaurantSettings();
    return success({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request) {
  try {
    await requireAdmin(request, ['ADMIN']);
    const body = await request.json();
    const parsed = settingsSchema.safeParse({
      ...body,
      cancellationFee: Number(body.cancellationFee ?? 0),
    });

    if (!parsed.success) {
      return failure('Invalid settings payload', 400, { details: parsed.error.flatten() });
    }

    const existingSettings = await getRestaurantSettings();

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
      where: { id: 1 },
      data: {
        openingTime: parsed.data.openingTime,
        closingTime: parsed.data.closingTime,
        allowCancelPaid: Boolean(parsed.data.allowCancelPaid),
        allowCancelInProgress: Boolean(parsed.data.allowCancelInProgress),
        cancellationFee: parsed.data.cancellationFee ?? 0,
        workingHoursByDay: JSON.stringify(normalizedWorkingHours),
        displayHours: nextDisplayHours,
        displayHours: JSON.stringify(nextDisplayHours),
      },
    });

    return success({
      settings: {
        ...settings,
        workingHoursByDay: normalizedWorkingHours,
        displayHours: nextDisplayHours,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}