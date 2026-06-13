export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../lib/api-response';
import {
  PURCHASE_INVOICE_STATUSES,
  calculatePurchaseInvoiceTotals,
  isValidPurchaseInvoiceStatus,
  normalizePurchaseInvoice,
  normalizePurchaseInvoices,
} from '../../../../lib/purchase-invoices';
import { prisma } from '../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';

const lineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  inventoryItemId: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(40),
  unitCost: z.coerce.number().nonnegative(),
  notes: z.string().trim().max(300).optional().nullable(),
});

const createPurchaseInvoiceSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  invoiceNumber: z.string().trim().min(1).max(80),
  status: z.string().trim().optional(),
  invoiceDate: z.string().trim().min(1),
  dueDate: z.string().trim().optional().nullable(),
  currency: z.string().trim().max(6).optional().nullable(),
  supplierId: z.string().trim().optional().nullable(),
  purchaseRequestId: z.string().trim().optional().nullable(),
  taxAmount: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  lines: z.array(lineSchema).min(1).max(100),
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

function cleanRequiredDate(value, label) {
  const cleaned = normalizeOptionalText(value);
  if (!cleaned) throw new TenantPurchaseInvoiceError(`${label} is required`, 400);
  const date = new Date(`${cleaned}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new TenantPurchaseInvoiceError(`${label} is invalid`, 400);
  return date;
}

function cleanOptionalDate(value, label) {
  const cleaned = normalizeOptionalText(value);
  if (!cleaned) return null;
  const date = new Date(`${cleaned}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new TenantPurchaseInvoiceError(`${label} is invalid`, 400);
  return date;
}

function getCreateStatus(status) {
  const cleanStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';
  if (!cleanStatus) return PURCHASE_INVOICE_STATUSES.DRAFT;
  if (!isValidPurchaseInvoiceStatus(cleanStatus)) {
    throw new TenantPurchaseInvoiceError('Invalid purchase invoice status', 400);
  }
  return cleanStatus;
}

function isUniqueInvoiceNumberError(error) {
  return error?.code === 'P2002';
}

async function validateSupplierOwnership(tx, supplierId, restaurantId) {
  if (!supplierId) return null;
  const supplier = await tx.supplier.findFirst({
    where: { id: supplierId, restaurantId, isActive: true },
    select: { id: true },
  });

  if (!supplier) {
    throw new TenantPurchaseInvoiceError('Supplier not found', 404);
  }

  return supplier.id;
}

async function validatePurchaseRequestOwnership(tx, purchaseRequestId, restaurantId) {
  if (!purchaseRequestId) return null;
  const purchaseRequest = await tx.purchaseRequest.findFirst({
    where: { id: purchaseRequestId, restaurantId },
    select: { id: true },
  });

  if (!purchaseRequest) {
    throw new TenantPurchaseInvoiceError('Purchase request not found', 404);
  }

  return purchaseRequest.id;
}

async function buildScopedLineCreateData(tx, lines, restaurantId) {
  const inventoryItemIds = [
    ...new Set(lines.map((line) => cleanId(line.inventoryItemId)).filter(Boolean)),
  ];
  const inventoryItems = inventoryItemIds.length
    ? await tx.inventoryItem.findMany({
        where: {
          id: { in: inventoryItemIds },
          restaurantId,
          isActive: true,
        },
        select: {
          id: true,
        },
      })
    : [];
  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));

  return lines.map((line) => {
    const inventoryItemId = cleanId(line.inventoryItemId);
    if (inventoryItemId && !inventoryById.has(inventoryItemId)) {
      throw new TenantPurchaseInvoiceError('Inventory item not found', 404);
    }

    return {
      restaurantId,
      inventoryItemId,
      description: line.description.trim(),
      quantity: line.quantity,
      unit: line.unit.trim(),
      unitCost: line.unitCost,
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
    if (isValidPurchaseInvoiceStatus(status)) where.status = status;

    const purchaseInvoices = await prisma.purchaseInvoice.findMany({
      where,
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      include: purchaseInvoiceInclude,
    });
    const filteredInvoices = search
      ? purchaseInvoices.filter((invoice) =>
          [
            invoice.invoiceNumber,
            invoice.status,
            invoice.notes,
            invoice.supplier?.name,
            invoice.purchaseRequest?.reference,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(search)
        )
      : purchaseInvoices;

    return success({
      purchaseInvoices: normalizePurchaseInvoices(filteredInvoices),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = createPurchaseInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid purchase invoice payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const duplicateInvoice = await prisma.purchaseInvoice.findFirst({
      where: {
        restaurantId: staff.restaurantId,
        invoiceNumber: parsed.data.invoiceNumber.trim(),
      },
      select: { id: true },
    });

    if (duplicateInvoice) {
      return failure(DUPLICATE_INVOICE_NUMBER_MESSAGE, 409);
    }

    const purchaseInvoice = await prisma.$transaction(async (tx) => {
      const supplierId = await validateSupplierOwnership(
        tx,
        cleanId(parsed.data.supplierId),
        staff.restaurantId,
      );
      const purchaseRequestId = await validatePurchaseRequestOwnership(
        tx,
        cleanId(parsed.data.purchaseRequestId),
        staff.restaurantId,
      );
      const lineData = await buildScopedLineCreateData(tx, parsed.data.lines, staff.restaurantId);
      const totals = calculatePurchaseInvoiceTotals(lineData, parsed.data.taxAmount || 0);

      return tx.purchaseInvoice.create({
        data: {
          restaurantId: staff.restaurantId,
          invoiceNumber: parsed.data.invoiceNumber.trim(),
          status: getCreateStatus(parsed.data.status),
          invoiceDate: cleanRequiredDate(parsed.data.invoiceDate, 'Invoice date'),
          dueDate: cleanOptionalDate(parsed.data.dueDate, 'Due date'),
          currency: cleanCurrency(parsed.data.currency),
          supplierId,
          purchaseRequestId,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          notes: normalizeOptionalText(parsed.data.notes),
          createdByAdminId: staff.id,
          createdByAdminEmail: staff.email,
          lines: {
            create: totals.lines,
          },
        },
        include: purchaseInvoiceInclude,
      });
    });

    return success({ purchaseInvoice: normalizePurchaseInvoice(purchaseInvoice) });
  } catch (error) {
    if (isUniqueInvoiceNumberError(error)) {
      return failure(DUPLICATE_INVOICE_NUMBER_MESSAGE, 409);
    }

    return handleApiError(error);
  }
}
