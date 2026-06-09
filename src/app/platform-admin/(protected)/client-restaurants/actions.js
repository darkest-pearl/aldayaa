'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
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
import {
  RESTAURANT_STAFF_ROLES,
  hashRestaurantStaffPassword,
  normalizeRestaurantStaffEmail,
} from '../../../../lib/restaurant-staff-auth';

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

function redirectWithProvisioned(message) {
  redirect(`/platform-admin/client-restaurants?provisioned=${encodeURIComponent(message)}`);
}

function redirectWithOwner(message) {
  redirect(`/platform-admin/client-restaurants?owner=${encodeURIComponent(message)}`);
}

const ownerAccessSchema = z.object({
  restaurantId: z.string().min(1),
  name: z.string().trim().optional(),
  email: z.string().email(),
  password: z.string().min(10),
});

const STARTER_MENU_CATEGORIES = Object.freeze([
  { name: 'House Starters', description: 'Simple opening plates for the starter menu.', sortOrder: 10 },
  { name: 'Main Plates', description: 'Core dishes to shape the first public menu.', sortOrder: 20 },
]);

const STARTER_MENU_ITEMS = Object.freeze([
  {
    categoryName: 'House Starters',
    name: 'Signature Starter Plate',
    description: 'A placeholder starter item ready for the restaurant team to customize.',
    price: 28,
    imageUrl: '/images/food-mezze.jpg',
  },
  {
    categoryName: 'Main Plates',
    name: 'House Main Plate',
    description: 'A sample main dish for validating the tenant menu experience.',
    price: 48,
    imageUrl: '/images/food-grill.jpg',
  },
  {
    categoryName: 'Main Plates',
    name: 'Fresh Daily Special',
    description: 'A flexible starter menu item for future real menu setup.',
    price: 36,
    imageUrl: '/images/food-salads.jpg',
  },
]);

const STARTER_GALLERY_CATEGORY = 'Starter Gallery';

const STARTER_GALLERY_PHOTOS = Object.freeze([
  {
    title: 'Restaurant atmosphere placeholder',
    description: 'Starter gallery image for the tenant public page.',
    imageUrl: '/images/interior-1.jpg',
  },
  {
    title: 'Signature dish placeholder',
    description: 'Starter gallery food image for the tenant public page.',
    imageUrl: '/images/food-mezze.jpg',
  },
]);

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

export async function provisionRestaurantStarterContent(formData) {
  const admin = await getAdminFromRequest(cookies());

  if (!admin || admin.role !== 'ADMIN') {
    redirectWithError('Only platform ADMIN users can provision starter menu/gallery content.');
  }

  const restaurantId = cleanRequiredField(formData.get('restaurantId'));

  if (!restaurantId) {
    redirectWithError('Restaurant is required for starter content provisioning.');
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    redirectWithError('Restaurant was not found.');
  }

  if (restaurant.slug === DEMO_RESTAURANT_SLUG) {
    redirectWithError('Starter provisioning does not modify Demo Restaurant data.');
  }

  const [existingProfile, existingSettings] = await Promise.all([
    prisma.restaurantProfile.findUnique({
      where: { restaurantId: restaurant.id },
    }),
    prisma.restaurantSettings.findUnique({
      where: { restaurantId: restaurant.id },
    }),
  ]);

  if (!existingProfile || !existingSettings) {
    redirectWithError('Initialize profile/settings before provisioning starter menu/gallery content.');
  }

  const [existingMenuCategories, existingMenuItemCount, existingGalleryCategories, existingPhotoCount] =
    await Promise.all([
      prisma.menuCategory.findMany({
        where: { restaurantId: restaurant.id },
        select: { id: true, name: true },
      }),
      prisma.menuItem.count({
        where: { restaurantId: restaurant.id },
      }),
      prisma.galleryCategory.findMany({
        where: { restaurantId: restaurant.id },
        select: { id: true, name: true },
      }),
      prisma.photo.count({
        where: { restaurantId: restaurant.id },
      }),
    ]);

  let createdMenu = false;
  let createdGallery = false;

  if (existingMenuItemCount === 0) {
    const categoryByName = new Map(existingMenuCategories.map((category) => [category.name, category]));

    for (const starterCategory of STARTER_MENU_CATEGORIES) {
      if (!categoryByName.has(starterCategory.name)) {
        const category = await prisma.menuCategory.create({
          data: {
            ...starterCategory,
            restaurantId: restaurant.id,
          },
          select: { id: true, name: true },
        });
        categoryByName.set(category.name, category);
      }
    }

    for (const starterItem of STARTER_MENU_ITEMS) {
      const category = categoryByName.get(starterItem.categoryName);
      if (!category) continue;

      await prisma.menuItem.create({
        data: {
          name: starterItem.name,
          description: starterItem.description,
          price: starterItem.price,
          imageUrl: starterItem.imageUrl,
          isAvailable: false,
          recommended: false,
          isSignature: false,
          categoryId: category.id,
          restaurantId: restaurant.id,
        },
      });
    }

    createdMenu = true;
  }

  if (existingPhotoCount === 0) {
    let galleryCategory = existingGalleryCategories.find((category) => category.name === STARTER_GALLERY_CATEGORY);

    if (!galleryCategory) {
      galleryCategory = await prisma.galleryCategory.create({
        data: {
          name: STARTER_GALLERY_CATEGORY,
          restaurantId: restaurant.id,
        },
        select: { id: true, name: true },
      });
    }

    for (const starterPhoto of STARTER_GALLERY_PHOTOS) {
      await prisma.photo.create({
        data: {
          ...starterPhoto,
          categoryId: galleryCategory.id,
          restaurantId: restaurant.id,
        },
      });
    }

    createdGallery = true;
  }

  revalidatePath('/platform-admin/client-restaurants');
  revalidatePath(`/r/${restaurant.slug}`);
  revalidatePath(`/r/${restaurant.slug}/menu`);
  revalidatePath(`/r/${restaurant.slug}/gallery`);

  if (!createdMenu && !createdGallery) {
    redirectWithProvisioned(`${restaurant.slug} already provisioned`);
  }

  if (!createdMenu || !createdGallery) {
    redirectWithProvisioned(`${restaurant.slug} partially provisioned`);
  }

  redirectWithProvisioned(`${restaurant.slug} provisioned`);
}

export async function createTenantOwnerAccess(formData) {
  const admin = await getAdminFromRequest(cookies());

  if (!admin || admin.role !== 'ADMIN') {
    redirectWithError('Only platform ADMIN users can create tenant owner access.');
  }

  const parsed = ownerAccessSchema.safeParse({
    restaurantId: cleanRequiredField(formData.get('restaurantId')),
    name: cleanOptionalField(formData.get('name')) || undefined,
    email: normalizeRestaurantStaffEmail(formData.get('email')),
    password: cleanRequiredField(formData.get('password')),
  });

  if (!parsed.success) {
    redirectWithError('Owner name, valid email, and a temporary password of at least 10 characters are required.');
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: parsed.data.restaurantId },
  });

  if (!restaurant) {
    redirectWithError('Restaurant was not found.');
  }

  if (restaurant.slug === DEMO_RESTAURANT_SLUG) {
    redirectWithError('Tenant owner access does not modify Demo Restaurant data.');
  }

  if (restaurant.status === 'ARCHIVED') {
    redirectWithError('Archived restaurants cannot receive tenant owner access.');
  }

  const [existingProfile, existingSettings] = await Promise.all([
    prisma.restaurantProfile.findUnique({
      where: { restaurantId: restaurant.id },
    }),
    prisma.restaurantSettings.findUnique({
      where: { restaurantId: restaurant.id },
    }),
  ]);

  if (!existingProfile || !existingSettings) {
    redirectWithError('Initialize profile/settings before creating tenant owner access.');
  }

  const existingOwnerCount = await prisma.restaurantUser.count({
    where: {
      restaurantId: restaurant.id,
      role: RESTAURANT_STAFF_ROLES.OWNER,
    },
  });

  if (existingOwnerCount > 0) {
    redirectWithError('This restaurant already has an OWNER account.');
  }

  const existingStaffUser = await prisma.restaurantUser.findUnique({
    where: {
      restaurantId_email: {
        restaurantId: restaurant.id,
        email: parsed.data.email,
      },
    },
  });

  if (existingStaffUser) {
    redirectWithError('A staff user with this email already exists for this restaurant.');
  }

  const passwordHash = await hashRestaurantStaffPassword(parsed.data.password);

  await prisma.restaurantUser.create({
    data: {
      restaurantId: restaurant.id,
      name: parsed.data.name || null,
      email: parsed.data.email,
      passwordHash,
      role: RESTAURANT_STAFF_ROLES.OWNER,
      isActive: true,
    },
  });

  revalidatePath('/platform-admin/client-restaurants');
  redirectWithOwner(`${restaurant.slug} owner access created`);
}
