import { z } from 'zod';
import { requireAdmin } from '../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';
import {
  DAYS_OF_WEEK,
  getRestaurantSettings,
  normalizeWorkingHoursByDay,
} from '../../../../lib/restaurant-settings';

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

    await getRestaurantSettings();

    const normalizedWorkingHours = normalizeWorkingHoursByDay(
      parsed.data.workingHoursByDay,
      parsed.data.openingTime,
      parsed.data.closingTime,
    );
    
    const settings = await prisma.restaurantSettings.update({
      where: { id: 1 },
      data: {
        openingTime: parsed.data.openingTime,
        closingTime: parsed.data.closingTime,
        allowCancelPaid: Boolean(parsed.data.allowCancelPaid),
        allowCancelInProgress: Boolean(parsed.data.allowCancelInProgress),
        cancellationFee: parsed.data.cancellationFee ?? 0,
        workingHoursByDay: JSON.stringify(normalizedWorkingHours),
      },
    });

    return success({ settings: { ...settings, workingHoursByDay: normalizedWorkingHours } });
  } catch (error) {
    return handleApiError(error);
  }
}