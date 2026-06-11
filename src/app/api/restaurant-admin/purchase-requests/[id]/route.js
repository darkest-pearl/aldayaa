export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import {
  isValidPurchaseRequestStatus,
  normalizePurchaseRequest,
} from '../../../../../lib/purchase-requests';
import { prisma } from '../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';

const updatePurchaseRequestSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  supplierId: z.string().trim().optional().nullable(),
  status: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  expectedDate: z.string().trim().optional().nullable(),
});

const purchaseRequestInclude = {
  supplier: true,
  lines: {
    orderBy: { createdAt: 'asc' },
    include: { inventoryItem: true },
  },
};

function cleanSupplierId(value) {
  return normalizeOptionalText(value);
}

function cleanExpectedDate(value) {
  const cleaned = normalizeOptionalText(value);
  if (!cleaned) return null;
  const date = new Date(`${cleaned}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function validateSupplierOwnership(supplierId, restaurantId) {
  if (!supplierId) return null;
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, restaurantId, isActive: true },
    select: { id: true },
  });

  return supplier?.id || null;
}

function buildUpdateData(data, supplierId) {
  const update = {};
  if (data.status !== undefined) {
    const status = data.status.trim().toUpperCase();
    if (isValidPurchaseRequestStatus(status)) update.status = status;
  }
  if (data.supplierId !== undefined) update.supplierId = supplierId;
  if (data.expectedDate !== undefined) update.expectedDate = cleanExpectedDate(data.expectedDate);
  if (data.notes !== undefined) update.notes = normalizeOptionalText(data.notes);
  return update;
}

export async function GET(request, { params }) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const purchaseRequest = await prisma.purchaseRequest.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      include: purchaseRequestInclude,
    });

    if (!purchaseRequest) return failure('Purchase request not found', 404);

    return success({
      purchaseRequest: normalizePurchaseRequest(purchaseRequest),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = updatePurchaseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid purchase request payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existing = await prisma.purchaseRequest.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true },
    });

    if (!existing) return failure('Purchase request not found', 404);

    let supplierId = undefined;
    if (parsed.data.supplierId !== undefined) {
      supplierId = await validateSupplierOwnership(cleanSupplierId(parsed.data.supplierId), staff.restaurantId);
      if (cleanSupplierId(parsed.data.supplierId) && !supplierId) return failure('Supplier not found', 404);
    }

    if (parsed.data.status !== undefined && !isValidPurchaseRequestStatus(parsed.data.status.trim().toUpperCase())) {
      return failure('Invalid purchase request status', 400);
    }

    const updated = await prisma.purchaseRequest.updateMany({
      where: { id: params.id, restaurantId: staff.restaurantId },
      data: buildUpdateData(parsed.data, supplierId),
    });

    if (updated.count !== 1) {
      return failure('Purchase request not found', 404);
    }

    const purchaseRequest = await prisma.purchaseRequest.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      include: purchaseRequestInclude,
    });

    if (!purchaseRequest) return failure('Purchase request not found', 404);

    return success({ purchaseRequest: normalizePurchaseRequest(purchaseRequest) });
  } catch (error) {
    return handleApiError(error);
  }
}
