export const dynamic = "force-dynamic";

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';

const moduleSchema = z.string().trim().min(2).max(120);

const leadSchema = z.object({
  restaurantName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(60),
  email: z.union([z.literal(''), z.string().trim().email().max(160)]).optional(),
  interestedModules: z.array(moduleSchema).max(20).optional(),
  message: z.string().trim().max(1200).optional(),
});

function cleanOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function POST(request) {
  try {
    if (!process.env.DATABASE_URL) {
      return failure('Gateway lead capture is temporarily unavailable', 503);
    }

    const body = await request.json();
    const parsed = leadSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid lead request', 400, { details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const lead = await prisma.gatewayLead.create({
      data: {
        restaurantName: data.restaurantName.trim(),
        contactName: data.contactName.trim(),
        phone: data.phone.trim(),
        email: cleanOptionalString(data.email),
        interestedModules: data.interestedModules?.length ? JSON.stringify(data.interestedModules) : null,
        message: cleanOptionalString(data.message),
      },
      select: {
        id: true,
        restaurantName: true,
        status: true,
        createdAt: true,
      },
    });

    return success({ lead }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
