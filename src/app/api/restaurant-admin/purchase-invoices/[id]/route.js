export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import {
  calculatePurchaseInvoiceTotals,
  isValidPurchaseInvoiceStatus,
  normalizePurchaseInvoice,
} from '../../../../../lib/purchase-invoices';
import { prisma } from '../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';

const updatePurchaseInvoiceSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  invoiceNumber: z.string().trim().min(1).max(80).optional(),
  status: z.string().trim().optional(),
  invoiceDate: z.string().trim().optional(),
  dueDate: z.string().trim().optional().nullable(),
  currency: z.string().trim().max(6).optional().nullable(),
  supplierId: z.string().trim().optional().nullable(),
  purchaseRequestId: z.string().trim().optional().nullable(),
  taxAmount: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const purchaseInvoiceInclude = {
  supplier: true,
  purchaseRequest: true,
  lines: {
    orderBy: { createdAt: 'asc' },
    include: { inventoryItem: true },
  },
};

function cleanId(value) {
  return normalizeOptionalText(value);
}

function cleanCurrency(value) {
  return (normalizeOptionalText(value) || 'AED').toUpperCase();
}

function cleanDate(value) {
  const cleaned = normalizeOptionalText(value);
  if (!cleaned) return null;
  const date = new Date(`${cleaned}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRequestedStatus(data) {
  if (data.status === undefined) return undefined;
  return data.status.trim().toUpperCase();
}

async function validateSupplierOwnership(supplierId, restaurantId) {
  if (!supplierId) return null;
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, restaurantId, isActive: true },
    select: { id: true },
  });

  return supplier?.id || null;
}

async function validatePurchaseRequestOwnership(purchaseRequestId, restaurantId) {
  if (!purchaseRequestId) return null;
  const purchaseRequest = await prisma.purchaseRequest.findFirst({
    where: { id: purchaseRequestId, restaurantId },
    select: { id: true },
  });

  return purchaseRequest?.id || null;
}

function buildUpdateData(data, supplierId, purchaseRequestId, requestedStatus, existing) {
  const update = {};
  if (data.invoiceNumber !== undefined) update.invoiceNumber = data.invoiceNumber.trim();
  if (requestedStatus !== undefined && isValidPurchaseInvoiceStatus(requestedStatus)) update.status = requestedStatus;
  if (data.invoiceDate !== undefined) {
    const invoiceDate = cleanDate(data.invoiceDate);
    if (invoiceDate) update.invoiceDate = invoiceDate;
  }
  if (data.dueDate !== undefined) update.dueDate = cleanDate(data.dueDate);
  if (data.currency !== undefined) update.currency = cleanCurrency(data.currency);
  if (data.supplierId !== undefined) update.supplierId = supplierId;
  if (data.purchaseRequestId !== undefined) update.purchaseRequestId = purchaseRequestId;
  if (data.taxAmount !== undefined) {
    const totals = calculatePurchaseInvoiceTotals([{ quantity: 1, unitCost: existing.subtotal }], data.taxAmount);
    update.taxAmount = totals.taxAmount;
    update.totalAmount = totals.totalAmount;
  }
  if (data.notes !== undefined) update.notes = normalizeOptionalText(data.notes);
  return update;
}

export async function GET(request, { params }) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const purchaseInvoice = await prisma.purchaseInvoice.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      include: purchaseInvoiceInclude,
    });

    if (!purchaseInvoice) return failure('Purchase invoice not found', 404);

    return success({
      purchaseInvoice: normalizePurchaseInvoice(purchaseInvoice),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = updatePurchaseInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid purchase invoice payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existing = await prisma.purchaseInvoice.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true, subtotal: true },
    });

    if (!existing) return failure('Purchase invoice not found', 404);

    const requestedStatus = getRequestedStatus(parsed.data);
    if (requestedStatus !== undefined && !isValidPurchaseInvoiceStatus(requestedStatus)) {
      return failure('Invalid purchase invoice status', 400);
    }

    let supplierId = undefined;
    if (parsed.data.supplierId !== undefined) {
      supplierId = await validateSupplierOwnership(cleanId(parsed.data.supplierId), staff.restaurantId);
      if (cleanId(parsed.data.supplierId) && !supplierId) return failure('Supplier not found', 404);
    }

    let purchaseRequestId = undefined;
    if (parsed.data.purchaseRequestId !== undefined) {
      purchaseRequestId = await validatePurchaseRequestOwnership(
        cleanId(parsed.data.purchaseRequestId),
        staff.restaurantId,
      );
      if (cleanId(parsed.data.purchaseRequestId) && !purchaseRequestId) return failure('Purchase request not found', 404);
    }

    if (parsed.data.invoiceDate !== undefined && !cleanDate(parsed.data.invoiceDate)) {
      return failure('Invoice date is invalid', 400);
    }
    if (parsed.data.dueDate !== undefined && normalizeOptionalText(parsed.data.dueDate) && !cleanDate(parsed.data.dueDate)) {
      return failure('Due date is invalid', 400);
    }

    const updated = await prisma.purchaseInvoice.updateMany({
      where: { id: params.id, restaurantId: staff.restaurantId },
      data: buildUpdateData(parsed.data, supplierId, purchaseRequestId, requestedStatus, existing),
    });

    if (updated.count !== 1) {
      return failure('Purchase invoice not found', 404);
    }

    const purchaseInvoice = await prisma.purchaseInvoice.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      include: purchaseInvoiceInclude,
    });

    if (!purchaseInvoice) return failure('Purchase invoice not found', 404);

    return success({ purchaseInvoice: normalizePurchaseInvoice(purchaseInvoice) });
  } catch (error) {
    return handleApiError(error);
  }
}
