export const dynamic = 'force-dynamic';

import { failure, handleApiError, success } from '../../../../lib/api-response';
import {
  isValidPaymentProviderEventStatus,
  isValidPaymentProviderMode,
  normalizePaymentProviderEvents,
} from '../../../../lib/payment-provider-events';
import { prisma } from '../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  isRestaurantStaffWriteRole,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';

const MAX_PAYMENT_PROVIDER_EVENT_LIMIT = 100;
const MAX_PAYMENT_PROVIDER_EVENT_RANGE_DAYS = 366;

function parseDateOnly(value, label) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  if (!cleaned) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const error = new Error(`${label} date is invalid`);
    error.status = 400;
    throw error;
  }

  const date = new Date(`${cleaned}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== cleaned) {
    const error = new Error(`${label} date is invalid`);
    error.status = 400;
    throw error;
  }

  return date;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getLimit(value) {
  const limit = Number(value || 50);
  if (!Number.isFinite(limit) || limit < 1) return 50;
  return Math.min(Math.floor(limit), MAX_PAYMENT_PROVIDER_EVENT_LIMIT);
}

function getReceivedAtWhere(searchParams) {
  const from = parseDateOnly(searchParams.get('from') || '', 'From');
  const to = parseDateOnly(searchParams.get('to') || '', 'To');
  if (!from && !to) return {};
  if ((from && !to) || (!from && to)) {
    const error = new Error('From and To dates are required when filtering payment provider events');
    error.status = 400;
    throw error;
  }

  const rangeDays = Math.round((addDays(to, 1).getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays <= 0 || rangeDays > MAX_PAYMENT_PROVIDER_EVENT_RANGE_DAYS) {
    const error = new Error(`Payment provider event date range must be between 1 and ${MAX_PAYMENT_PROVIDER_EVENT_RANGE_DAYS} days`);
    error.status = 400;
    throw error;
  }

  return {
    receivedAt: {
      gte: from,
      lt: addDays(to, 1),
    },
  };
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    if (!isRestaurantStaffWriteRole(staff.role)) {
      return failure('OWNER or MANAGER access is required to view payment provider events', 403);
    }

    const { searchParams } = new URL(request.url);
    const provider = (searchParams.get('provider') || '').trim();
    const providerMode = (searchParams.get('providerMode') || '').trim().toUpperCase();
    const eventType = (searchParams.get('eventType') || '').trim();
    const status = (searchParams.get('status') || '').trim().toUpperCase();
    const limit = getLimit(searchParams.get('limit'));
    const where = { restaurantId: staff.restaurantId };

    Object.assign(where, getReceivedAtWhere(searchParams));
    if (provider) where.provider = provider;
    if (providerMode) {
      if (!isValidPaymentProviderMode(providerMode)) return failure('Invalid provider mode filter', 400);
      where.providerMode = providerMode;
    }
    if (eventType) where.eventType = eventType;
    if (status) {
      if (!isValidPaymentProviderEventStatus(status)) return failure('Invalid payment provider event status filter', 400);
      where.status = status;
    }

    const events = await prisma.paymentProviderEvent.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: limit + 1,
    });

    return success({
      events: normalizePaymentProviderEvents(events.slice(0, limit)),
      hasMore: events.length > limit,
      limit,
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
