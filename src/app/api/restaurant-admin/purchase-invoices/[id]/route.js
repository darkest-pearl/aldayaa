export const dynamic = 'force-dynamic';

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import {
  PURCHASE_INVOICE_PAYMENT_STATUSES,
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
  payments: {
    orderBy: { paidAt: 'desc' },
  },
};

const DUPLICATE_INVOICE_NUMBER_MESSAGE = 'Purchase invoice number is already used for this restaurant';

class TenantPurchaseInvoiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

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

function isUniqueInvoiceNumberError(error) {
  return error?.code === 'P2002';
}

function isTransactionConflictError(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error?.code === 'P2034';
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function validateSupplierOwnership(client, supplierId, restaurantId) {
  if (!supplierId) return null;
  const supplier = await client.supplier.findFirst({
    where: { id: supplierId, restaurantId, isActive: true },
    select: { id: true },
  });

  return supplier?.id || null;
}

async function validatePurchaseRequestOwnership(client, purchaseRequestId, restaurantId) {
  if (!purchaseRequestId) return null;
  const purchaseRequest = await client.purchaseRequest.findFirst({
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

function assertPaymentSensitiveUpdateAllowed(data, requestedStatus, existing, recordedPaidAmount) {
  if (recordedPaidAmount <= 0) return;

  if (data.currency !== undefined && cleanCurrency(data.currency) !== existing.currency) {
    throw new TenantPurchaseInvoiceError('Purchase invoice currency cannot change after payments are recorded', 400);
  }

  if (requestedStatus !== undefined && requestedStatus !== existing.status) {
    throw new TenantPurchaseInvoiceError('Purchase invoice status cannot change after payments are recorded', 400);
  }

  if (data.taxAmount !== undefined) {
    const totals = calculatePurchaseInvoiceTotals([{ quantity: 1, unitCost: existing.subtotal }], data.taxAmount);
    if (totals.totalAmount < recordedPaidAmount) {
      throw new TenantPurchaseInvoiceError('Purchase invoice total cannot be less than recorded payments', 400);
    }
  }
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

    const requestedStatus = getRequestedStatus(parsed.data);
    if (requestedStatus !== undefined && !isValidPurchaseInvoiceStatus(requestedStatus)) {
      return failure('Invalid purchase invoice status', 400);
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });

    if (parsed.data.invoiceDate !== undefined && !cleanDate(parsed.data.invoiceDate)) {
      return failure('Invoice date is invalid', 400);
    }
    if (parsed.data.dueDate !== undefined && normalizeOptionalText(parsed.data.dueDate) && !cleanDate(parsed.data.dueDate)) {
      return failure('Due date is invalid', 400);
    }

    const purchaseInvoice = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.purchaseInvoice.findFirst({
          where: { id: params.id, restaurantId: staff.restaurantId },
          select: {
            id: true,
            status: true,
            currency: true,
            subtotal: true,
            totalAmount: true,
          },
        });

        if (!existing) throw new TenantPurchaseInvoiceError('Purchase invoice not found', 404);

        if (parsed.data.invoiceNumber !== undefined) {
          const duplicateInvoice = await tx.purchaseInvoice.findFirst({
            where: {
              restaurantId: staff.restaurantId,
              invoiceNumber: parsed.data.invoiceNumber.trim(),
              NOT: { id: params.id },
            },
            select: { id: true },
          });

          if (duplicateInvoice) {
            throw new TenantPurchaseInvoiceError(DUPLICATE_INVOICE_NUMBER_MESSAGE, 409);
          }
        }

        let supplierId = undefined;
        if (parsed.data.supplierId !== undefined) {
          supplierId = await validateSupplierOwnership(tx, cleanId(parsed.data.supplierId), staff.restaurantId);
          if (cleanId(parsed.data.supplierId) && !supplierId) throw new TenantPurchaseInvoiceError('Supplier not found', 404);
        }

        let purchaseRequestId = undefined;
        if (parsed.data.purchaseRequestId !== undefined) {
          purchaseRequestId = await validatePurchaseRequestOwnership(
            tx,
            cleanId(parsed.data.purchaseRequestId),
            staff.restaurantId,
          );
          if (cleanId(parsed.data.purchaseRequestId) && !purchaseRequestId) {
            throw new TenantPurchaseInvoiceError('Purchase request not found', 404);
          }
        }

        const recordedPayments = await tx.purchaseInvoicePayment.aggregate({
          _sum: { amount: true },
          where: {
            purchaseInvoiceId: params.id,
            restaurantId: staff.restaurantId,
            status: PURCHASE_INVOICE_PAYMENT_STATUSES.RECORDED,
          },
        });
        const recordedPaidAmount = toNumber(recordedPayments._sum.amount);
        assertPaymentSensitiveUpdateAllowed(parsed.data, requestedStatus, existing, recordedPaidAmount);

        const updated = await tx.purchaseInvoice.updateMany({
          where: { id: params.id, restaurantId: staff.restaurantId },
          data: buildUpdateData(parsed.data, supplierId, purchaseRequestId, requestedStatus, existing),
        });

        if (updated.count !== 1) {
          throw new TenantPurchaseInvoiceError('Purchase invoice not found', 404);
        }

        const updatedPurchaseInvoice = await tx.purchaseInvoice.findFirst({
          where: { id: params.id, restaurantId: staff.restaurantId },
          include: purchaseInvoiceInclude,
        });

        if (!updatedPurchaseInvoice) throw new TenantPurchaseInvoiceError('Purchase invoice not found', 404);

        return updatedPurchaseInvoice;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return success({ purchaseInvoice: normalizePurchaseInvoice(purchaseInvoice) });
  } catch (error) {
    if (isUniqueInvoiceNumberError(error)) {
      return failure(DUPLICATE_INVOICE_NUMBER_MESSAGE, 409);
    }
    if (isTransactionConflictError(error)) {
      return failure('Purchase invoice payment state changed; refresh and try again', 409);
    }

    return handleApiError(error);
  }
}
