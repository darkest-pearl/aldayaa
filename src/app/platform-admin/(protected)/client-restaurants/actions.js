'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminFromRequest } from '../../../../lib/auth';
import { FEATURE_KEYS } from '../../../../lib/features';
import { prisma } from '../../../../lib/prisma';
import {
  getNeutralDemoRestaurantProfile,
  toPrismaRestaurantProfileData,
} from '../../../../lib/restaurant-profile';
import { getDefaultRestaurantSettingsData } from '../../../../lib/restaurant-settings';
import {
  DEMO_RESTAURANT_SLUG,
  RESTAURANT_STATUSES,
  validateRestaurantSlug,
} from '../../../../lib/restaurants';

function cleanRequiredField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanOptionalField(value) {
  const cleaned = cleanRequiredField(value);
  return cleaned || null;
}

function normalizeRestaurantStatus(value) {
  const status = cleanRequiredField(value).toUpperCase() || 'ACTIVE';
  return RESTAURANT_STATUSES.includes(status) && status !== 'DEMO' ? status : 'ACTIVE';
}

function normalizeRestaurantType(value) {
  return cleanRequiredField(value).toUpperCase() || 'CLIENT';
}

function redirectWithError(message) {
  redirect(`/platform-admin/client-restaurants?error=${encodeURIComponent(message)}`);
}

function redirectWithInitialization(message) {
  redirect(`/platform-admin/client-restaurants?initialized=${encodeURIComponent(message)}`);
}

export async function createClientRestaurant(formData) {
  const admin = await getAdminFromRequest(cookies());

  if (!admin || admin.role !== 'ADMIN') {
    redirectWithError('Only platform ADMIN users can create restaurant tenant anchors.');
  }

  const name = cleanRequiredField(formData.get('name'));
  const rawSlug = cleanRequiredField(formData.get('slug'));
  const slugValidation = validateRestaurantSlug(rawSlug);

  if (name.length < 2) {
    redirectWithError('Restaurant name must be at least 2 characters.');
  }

  if (!slugValidation.valid) {
    redirectWithError(slugValidation.error);
  }

  const existingRestaurant = await prisma.restaurant.findUnique({
    where: { slug: slugValidation.slug },
  });

  if (existingRestaurant) {
    redirectWithError('A restaurant with this slug already exists.');
  }

  const created = await prisma.restaurant.create({
    data: {
      name,
      slug: slugValidation.slug,
      status: normalizeRestaurantStatus(formData.get('status')),
      type: normalizeRestaurantType(formData.get('type')),
      notes: cleanOptionalField(formData.get('notes')),
    },
  });

  revalidatePath('/platform-admin/client-restaurants');
  redirect(`/platform-admin/client-restaurants?created=${created.slug}`);
}

export async function initializeRestaurantBasics(formData) {
  const admin = await getAdminFromRequest(cookies());

  if (!admin || admin.role !== 'ADMIN') {
    redirectWithError('Only platform ADMIN users can initialize restaurant profile/settings.');
  }

  const restaurantId = cleanRequiredField(formData.get('restaurantId'));

  if (!restaurantId) {
    redirectWithError('Restaurant is required for profile/settings initialization.');
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    redirectWithError('Restaurant was not found.');
  }

  if (restaurant.slug === DEMO_RESTAURANT_SLUG) {
    redirectWithError('Use Demo Restaurant reset controls for the demo tenant.');
  }

  const [existingProfile, existingSettings] = await Promise.all([
    prisma.restaurantProfile.findUnique({
      where: { restaurantId: restaurant.id },
    }),
    prisma.restaurantSettings.findUnique({
      where: { restaurantId: restaurant.id },
    }),
  ]);

  if (existingProfile && existingSettings) {
    revalidatePath('/platform-admin/client-restaurants');
    redirectWithInitialization(`${restaurant.slug} already initialized`);
  }

  if (!existingProfile) {
    await prisma.restaurantProfile.create({
      data: {
        ...toPrismaRestaurantProfileData(
          getNeutralDemoRestaurantProfile({
            restaurantName: restaurant.name,
            tagline: 'Digital restaurant profile coming soon.',
            cuisineType: 'Restaurant',
            instagramUrl: 'https://example.com',
            facebookUrl: 'https://example.com',
            tiktokUrl: 'https://example.com',
            linktreeUrl: 'https://example.com',
            logoUrl: '/images/food-mezze.jpg',
            enabledFeatures: [
              FEATURE_KEYS.WEBSITE,
              FEATURE_KEYS.MENU,
              FEATURE_KEYS.CONTACT_WHATSAPP,
            ],
          }),
        ),
        restaurantId: restaurant.id,
      },
    });
  }

  if (!existingSettings) {
    await prisma.restaurantSettings.create({
      data: {
        ...getDefaultRestaurantSettingsData(),
        restaurantId: restaurant.id,
      },
    });
  }

  revalidatePath('/platform-admin/client-restaurants');

  if (existingProfile || existingSettings) {
    redirectWithInitialization(`${restaurant.slug} partially initialized`);
  }

  redirectWithInitialization(`${restaurant.slug} initialized`);
}
