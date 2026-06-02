export const dynamic = "force-dynamic";

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';

const moduleSchema = z.string().trim().min(2).max(80);

const leadSchema = z.object({
  restaurantName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(60),
  email: z.union([z.literal(''), z.string().trim().email().max(160)]).optional(),
  interestedModules: z.array(moduleSchema).max(12).optional(),
  message: z.string().trim().max(1200).optional(),
  companyWebsite: z.string().trim().max(200).optional(),
});

function cleanRequiredString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizePhone(value) {
  return cleanRequiredString(value).replace(/[^\d+()\-\s]/g, '').replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  const cleaned = cleanOptionalString(value);
  return cleaned ? cleaned.toLowerCase() : null;
}

function normalizeInterestedModules(modules = []) {
  const seen = new Set();
  const normalized = [];

  for (const moduleName of modules) {
    const cleaned = cleanOptionalString(moduleName);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    normalized.push(cleaned);
  }

  return normalized.slice(0, 12);
}

function isLikelyBotSubmission(data) {
  return Boolean(data.companyWebsite);
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
    if (isLikelyBotSubmission(data)) {
      return success({ lead: null }, { status: 201 });
    }

    const interestedModules = normalizeInterestedModules(data.interestedModules);
    const lead = await prisma.gatewayLead.create({
      data: {
        restaurantName: cleanRequiredString(data.restaurantName),
        contactName: cleanRequiredString(data.contactName),
        phone: normalizePhone(data.phone),
        email: normalizeEmail(data.email),
        interestedModules: interestedModules.length ? JSON.stringify(interestedModules) : null,
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
