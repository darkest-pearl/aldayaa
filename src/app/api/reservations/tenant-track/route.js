export const dynamic = "force-dynamic";

import { z } from 'zod';
import { failure, success } from '../../../../lib/api-response';
import { FEATURE_KEYS, isFeatureEnabled } from '../../../../lib/features';
import { prisma } from '../../../../lib/prisma';
import { DEMO_RESTAURANT_SLUG } from '../../../../lib/restaurants';

const tenantReservationSupportSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  reference: z.string().trim().min(3),
  phone: z.string().trim().min(4),
});

const RESTAURANT_TIME_ZONE = 'Asia/Dubai';

function normalizeTenantReservationSupportSlug(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function formatDubaiDateOnly(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: RESTAURANT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const getPart = (type) => parts.find((part) => part.type === type)?.value;
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');

  return year && month && day ? `${year}-${month}-${day}` : null;
}

function normalizeTenantPublicReservation(reservation = {}) {
  return {
    reference: reservation.reference,
    status: reservation.status,
    date: formatDubaiDateOnly(reservation.date),
    time: reservation.time,
    partySize: reservation.guests,
    name: reservation.name || null,
  };
}

async function resolveTenantReservationSupportContext(restaurantSlug) {
  const normalizedSlug = normalizeTenantReservationSupportSlug(restaurantSlug);

  if (!normalizedSlug || normalizedSlug === DEMO_RESTAURANT_SLUG) {
    return {
      error: failure('Reservation support is not available for this restaurant', 404),
    };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: normalizedSlug },
    select: { id: true, status: true },
  });

  if (!restaurant || restaurant.status === 'ARCHIVED') {
    return {
      error: failure('Reservation support is not available for this restaurant', 404),
    };
  }

  const [profile, settings] = await Promise.all([
    prisma.restaurantProfile.findUnique({
      where: { restaurantId: restaurant.id },
      select: { id: true, enabledFeatures: true },
    }),
    prisma.restaurantSettings.findUnique({
      where: { restaurantId: restaurant.id },
      select: { id: true },
    }),
  ]);

  if (!profile || !settings) {
    return {
      error: failure('Restaurant reservation support is not initialized yet', 404),
    };
  }

  if (!isFeatureEnabled(profile.enabledFeatures, FEATURE_KEYS.RESERVATIONS)) {
    return {
      error: failure('Reservations are not available for this restaurant', 400),
    };
  }

  return { restaurantId: restaurant.id };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = tenantReservationSupportSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Restaurant slug, reference, and phone are required', 400, {
        details: parsed.error.flatten(),
      });
    }

    const context = await resolveTenantReservationSupportContext(parsed.data.restaurantSlug);
    if (context.error) return context.error;

    const reservation = await prisma.reservation.findFirst({
      where: { restaurantId: context.restaurantId, reference: parsed.data.reference, phone: parsed.data.phone },
      select: {
        reference: true,
        status: true,
        date: true,
        time: true,
        guests: true,
        name: true,
      },
    });

    if (!reservation) {
      return failure('Reservation not found', 404);
    }

    return success({
      reservation: normalizeTenantPublicReservation(reservation),
    });
  } catch (error) {
    console.error('Tenant reservation tracking error:', error);
    return failure('Unable to look up reservation', 500);
  }
}
