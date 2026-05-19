export const dynamic = "force-dynamic";
import { z } from 'zod';
import { requireAdmin } from '../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../lib/api-response';
import { FEATURE_KEY_VALUES, normalizeEnabledFeatures } from '../../../../lib/features';
import { prisma } from '../../../../lib/prisma';
import {
  defaultRestaurantProfile,
  getRestaurantProfile,
  normalizeRestaurantProfile,
  toPrismaRestaurantProfileData,
} from '../../../../lib/restaurant-profile';

const optionalUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || value.startsWith('/') || /^https?:\/\//i.test(value), {
    message: 'Must be empty, an absolute URL, or an app-relative path',
  });

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color');

const profileSchema = z.object({
  restaurantName: z.string().trim().min(2).max(120).optional(),
  tagline: z.string().trim().min(2).max(240).optional(),
  cuisineType: z.string().trim().min(2).max(120).optional(),
  whatsappNumber: z.string().trim().min(4).max(40).optional(),
  whatsappLink: optionalUrlSchema.optional(),
  address: z.string().trim().min(2).max(500).optional(),
  googleMapsUrl: optionalUrlSchema.optional(),
  googleMapsEmbedUrl: optionalUrlSchema.optional(),
  instagramUrl: optionalUrlSchema.optional(),
  facebookUrl: optionalUrlSchema.optional(),
  tiktokUrl: optionalUrlSchema.optional(),
  linktreeUrl: optionalUrlSchema.optional(),
  logoUrl: optionalUrlSchema.optional(),
  primaryColor: colorSchema.optional(),
  secondaryColor: colorSchema.optional(),
  currency: z.string().trim().min(2).max(8).optional(),
  enabledFeatures: z.array(z.enum(FEATURE_KEY_VALUES)).optional(),
});

function cleanProfilePayload(payload) {
  const cleaned = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ]),
  );

  if (Object.prototype.hasOwnProperty.call(cleaned, 'enabledFeatures')) {
    cleaned.enabledFeatures = JSON.stringify(normalizeEnabledFeatures(cleaned.enabledFeatures));
  }

  return cleaned;
}

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const profile = await getRestaurantProfile();
    return success({ profile });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request) {
  try {
    await requireAdmin(request, ['ADMIN']);
    const body = await request.json();
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid restaurant profile payload', 400, {
        details: parsed.error.flatten(),
      });
    }

    const updates = cleanProfilePayload(parsed.data);
    const profile = await prisma.restaurantProfile.upsert({
      where: { id: 1 },
      create: {
        ...toPrismaRestaurantProfileData(defaultRestaurantProfile),
        ...updates,
      },
      update: updates,
    });

    return success({ profile: normalizeRestaurantProfile(profile) });
  } catch (error) {
    return handleApiError(error);
  }
}
