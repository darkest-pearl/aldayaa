'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminFromRequest } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import {
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
