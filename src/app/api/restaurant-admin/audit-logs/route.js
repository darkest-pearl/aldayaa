export const dynamic = 'force-dynamic';

import { failure, handleApiError, success } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  isRestaurantStaffWriteRole,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';
import { normalizeTenantAuditLogs } from '../../../../lib/tenant-audit';

const MAX_AUDIT_RANGE_DAYS = 366;
const MAX_AUDIT_LIMIT = 100;

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

function getAuditDateWhere(searchParams) {
  const from = parseDateOnly(searchParams.get('from') || '', 'From');
  const to = parseDateOnly(searchParams.get('to') || '', 'To');
  if (!from && !to) return {};

  const createdAt = {};
  if (from) createdAt.gte = from;
  if (to) createdAt.lt = addDays(to, 1);

  if (from && to) {
    const rangeDays = Math.round((addDays(to, 1).getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    if (rangeDays <= 0 || rangeDays > MAX_AUDIT_RANGE_DAYS) {
      const error = new Error(`Audit log date range must be between 1 and ${MAX_AUDIT_RANGE_DAYS} days`);
      error.status = 400;
      throw error;
    }
  }

  return { createdAt };
}

function getLimit(value) {
  const limit = Number(value || 50);
  if (!Number.isFinite(limit) || limit < 1) return 50;
  return Math.min(Math.floor(limit), MAX_AUDIT_LIMIT);
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    if (!isRestaurantStaffWriteRole(staff.role)) {
      return failure('OWNER or MANAGER access is required to view audit logs', 403);
    }

    const { searchParams } = new URL(request.url);
    const action = (searchParams.get('action') || '').trim().toUpperCase();
    const entityType = (searchParams.get('entityType') || '').trim().toUpperCase();
    const limit = getLimit(searchParams.get('limit'));
    const where = { restaurantId: staff.restaurantId, ...getAuditDateWhere(searchParams) };
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const logs = await prisma.restaurantAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    return success({
      logs: normalizeTenantAuditLogs(logs.slice(0, limit)),
      hasMore: logs.length > limit,
      limit,
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
