export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../lib/api-response';
import {
  PURCHASE_REQUEST_STATUSES,
  isValidPurchaseRequestStatus,
  normalizePurchaseRequest,
  normalizePurchaseRequests,
} from '../../../../lib/purchase-requests';
import { prisma } from '../../../../lib/prisma';
import { generatePurchaseRequestReference } from '../../../../lib/reference';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';

const lineSchema = z.object({
  inventoryItemId: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  notes: z.string().trim().max(300).optional().nullable(),
});

const createPurchaseRequestSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  supplierId: z.string().trim().optional().nullable(),
  status: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  expectedDate: z.string().trim().optional().nullable(),
  lines: z.array(lineSchema).min(1).max(50),
});

const purchaseRequestInclude = {
  supplier: true,
  lines: {
    orderBy: { createdAt: 'asc' },
    include: { inventoryItem: true },
  },
};

class TenantPurchaseRequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function cleanSupplierId(value) {
  return normalizeOptionalText(value);
}

function cleanExpectedDate(value) {
  const cleaned = normalizeOptionalText(value);
  if (!cleaned) return null;
  const date = new Date(`${cleaned}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCreateStatus(status) {
  const cleanStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';
  return isValidPurchaseRequestStatus(cleanStatus) ? cleanStatus : PURCHASE_REQUEST_STATUSES.DRAFT;
}

async function validateSupplierOwnership(tx, supplierId, restaurantId) {
  if (!supplierId) return null;
  const supplier = await tx.supplier.findFirst({
    where: { id: supplierId, restaurantId, isActive: true },
    select: { id: true },
  });

  if (!supplier) {
    throw new TenantPurchaseRequestError('Supplier not found', 404);
  }

  return supplier.id;
}

async function buildScopedLineCreateData(tx, lines, restaurantId) {
  const inventoryItemIds = [...new Set(lines.map((line) => line.inventoryItemId))];
  const inventoryItems = await tx.inventoryItem.findMany({
    where: {
      id: { in: inventoryItemIds },
      restaurantId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      unit: true,
    },
  });
  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));

  return lines.map((line) => {
    const item = inventoryById.get(line.inventoryItemId);
    if (!item) {
      throw new TenantPurchaseRequestError('Inventory item not found', 404);
    }

    return {
      restaurantId,
      inventoryItemId: item.id,
      itemName: item.name,
      unit: item.unit,
      quantity: line.quantity,
      notes: normalizeOptionalText(line.notes),
    };
  });
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') || '').trim().toUpperCase();
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    const where = { restaurantId: staff.restaurantId };
    if (isValidPurchaseRequestStatus(status)) where.status = status;

    const purchaseRequests = await prisma.purchaseRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: purchaseRequestInclude,
    });
    const filteredRequests = search
      ? purchaseRequests.filter((request) =>
          [request.reference, request.status, request.notes, request.supplier?.name]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(search)
        )
      : purchaseRequests;

    return success({
      purchaseRequests: normalizePurchaseRequests(filteredRequests),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = createPurchaseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid purchase request payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const purchaseRequest = await prisma.$transaction(async (tx) => {
      const supplierId = await validateSupplierOwnership(
        tx,
        cleanSupplierId(parsed.data.supplierId),
        staff.restaurantId,
      );
      const lineData = await buildScopedLineCreateData(tx, parsed.data.lines, staff.restaurantId);

      return tx.purchaseRequest.create({
        data: {
          restaurantId: staff.restaurantId,
          reference: generatePurchaseRequestReference(),
          status: getCreateStatus(parsed.data.status),
          supplierId,
          expectedDate: cleanExpectedDate(parsed.data.expectedDate),
          notes: normalizeOptionalText(parsed.data.notes),
          createdByAdminId: staff.id,
          createdByAdminEmail: staff.email,
          lines: {
            create: lineData,
          },
        },
        include: purchaseRequestInclude,
      });
    });

    return success({ purchaseRequest: normalizePurchaseRequest(purchaseRequest) });
  } catch (error) {
    return handleApiError(error);
  }
}
