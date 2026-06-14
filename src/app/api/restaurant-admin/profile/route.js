export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';
import {
  normalizeRestaurantProfile,
  toPublicRestaurantProfile,
  toPrismaRestaurantProfileData,
} from '../../../../lib/restaurant-profile';
import {
  getRestaurantSlugFromRequest,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';
import { TENANT_AUDIT_ACTIONS, createTenantAuditLog } from '../../../../lib/tenant-audit';

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
  restaurantSlug: z.string().trim().min(1),
  restaurantName: z.string().trim().min(2).max(120),
  tagline: z.string().trim().min(2).max(240),
  cuisineType: z.string().trim().min(2).max(120),
  whatsappNumber: z.string().trim().min(4).max(40),
  whatsappLink: optionalUrlSchema,
  address: z.string().trim().min(2).max(500),
  googleMapsUrl: optionalUrlSchema,
  googleMapsEmbedUrl: optionalUrlSchema,
  instagramUrl: optionalUrlSchema,
  facebookUrl: optionalUrlSchema,
  tiktokUrl: optionalUrlSchema,
  linktreeUrl: optionalUrlSchema,
  logoUrl: optionalUrlSchema,
  primaryColor: colorSchema,
  secondaryColor: colorSchema,
  currency: z.string().trim().min(2).max(8),
});

function stripPlatformOwnedProfileFields(profile) {
  const safeProfile = { ...profile };
  delete safeProfile.restaurantSlug;
  delete safeProfile.enabledFeatures;
  delete safeProfile.restaurantId;
  delete safeProfile.restaurant;
  delete safeProfile.id;
  delete safeProfile.createdAt;
  delete safeProfile.updatedAt;
  return safeProfile;
}

async function loadTenantProfile(staff) {
  return prisma.restaurantProfile.findUnique({
    where: { restaurantId: staff.restaurantId },
  });
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const profile = await loadTenantProfile(staff);

    if (!profile) {
      return failure('Restaurant profile is not initialized for this tenant', 404);
    }

    return success({
      profile: toPublicRestaurantProfile(profile),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid restaurant profile payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existingProfile = await loadTenantProfile(staff);

    if (!existingProfile) {
      return failure('Restaurant profile is not initialized for this tenant', 404);
    }

    const safeProfile = stripPlatformOwnedProfileFields(parsed.data);
    const updatedProfile = await prisma.restaurantProfile.update({
      where: { restaurantId: staff.restaurantId },
      data: toPrismaRestaurantProfileData({
        ...normalizeRestaurantProfile(existingProfile),
        ...safeProfile,
        enabledFeatures: existingProfile.enabledFeatures,
      }),
    });

    await createTenantAuditLog({
      staff,
      request,
      action: TENANT_AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'PROFILE',
      entityId: String(updatedProfile.id),
      summary: 'Updated tenant restaurant profile',
      metadata: {
        restaurantName: updatedProfile.restaurantName,
        cuisineType: updatedProfile.cuisineType,
        currency: updatedProfile.currency,
      },
    });

    return success({ profile: toPublicRestaurantProfile(updatedProfile) });
  } catch (error) {
    return handleApiError(error);
  }
}
