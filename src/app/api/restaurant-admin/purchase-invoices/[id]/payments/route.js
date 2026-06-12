export const dynamic = 'force-dynamic';

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../../lib/api-response';
import {
  PURCHASE_INVOICE_PAYMENT_STATUSES,
  PURCHASE_INVOICE_STATUSES,
  normalizePurchaseInvoice,
  normalizePurchaseInvoicePayment,
} from '../../../../../../lib/purchase-invoices';
import { prisma } from '../../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../../lib/restaurant-staff-access';

const createPurchaseInvoicePaymentSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().max(6).optional().nullable(),
  method: z.string().trim().min(1).max(80),
  reference: z.string().trim().max(120).optional().nullable(),
  paidAt: z.string().trim().min(1),
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

class TenantPurchaseInvoicePaymentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function cleanCurrency(value, fallback = 'AED') {
  return (normalizeOptionalText(value) || fallback || 'AED').toUpperCase();
}

function cleanPaidAt(value) {
  const cleaned = normalizeOptionalText(value);
  if (!cleaned) throw new TenantPurchaseInvoicePaymentError('Paid date is required', 400);
  const date = new Date(`${cleaned}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new TenantPurchaseInvoicePaymentError('Paid date is invalid', 400);
  return date;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isTransactionConflictError(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error?.code === 'P2034';
}

function assertInvoiceCanAcceptPayment(invoice) {
  if (invoice.status === PURCHASE_INVOICE_STATUSES.DRAFT) {
    throw new TenantPurchaseInvoicePaymentError('Draft purchase invoices cannot record payments', 400);
  }
  if (invoice.status === PURCHASE_INVOICE_STATUSES.VOID) {
    throw new TenantPurchaseInvoicePaymentError('Void purchase invoices cannot record payments', 400);
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
      payments: purchaseInvoice.payments.map(normalizePurchaseInvoicePayment),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const parsed = createPurchaseInvoicePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid purchase invoice payment payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const result = await prisma.$transaction(
      async (tx) => {
        const invoice = await tx.purchaseInvoice.findFirst({
          where: { id: params.id, restaurantId: staff.restaurantId },
          select: {
            id: true,
            status: true,
            currency: true,
            totalAmount: true,
          },
        });

        if (!invoice) throw new TenantPurchaseInvoicePaymentError('Purchase invoice not found', 404);
        assertInvoiceCanAcceptPayment(invoice);

        const currency = cleanCurrency(parsed.data.currency, invoice.currency);
        if (currency !== invoice.currency) {
          throw new TenantPurchaseInvoicePaymentError('Payment currency must match invoice currency', 400);
        }

        const existingPayments = await tx.purchaseInvoicePayment.aggregate({
          _sum: { amount: true },
          where: {
            purchaseInvoiceId: invoice.id,
            restaurantId: staff.restaurantId,
            status: PURCHASE_INVOICE_PAYMENT_STATUSES.RECORDED,
          },
        });
        const paidAmount = roundMoney(existingPayments._sum.amount || 0);
        const paymentAmount = roundMoney(parsed.data.amount);
        const balanceDue = roundMoney(invoice.totalAmount - paidAmount);

        if (paymentAmount > balanceDue) {
          throw new TenantPurchaseInvoicePaymentError('Payment amount exceeds invoice balance', 400);
        }

        const payment = await tx.purchaseInvoicePayment.create({
          data: {
            restaurantId: staff.restaurantId,
            purchaseInvoiceId: invoice.id,
            amount: paymentAmount,
            currency,
            method: parsed.data.method.trim(),
            reference: normalizeOptionalText(parsed.data.reference),
            paidAt: cleanPaidAt(parsed.data.paidAt),
            notes: normalizeOptionalText(parsed.data.notes),
            status: PURCHASE_INVOICE_PAYMENT_STATUSES.RECORDED,
            createdByAdminId: staff.id,
            createdByAdminEmail: staff.email,
          },
        });

        const purchaseInvoice = await tx.purchaseInvoice.findFirst({
          where: { id: params.id, restaurantId: staff.restaurantId },
          include: purchaseInvoiceInclude,
        });

        if (!purchaseInvoice) throw new TenantPurchaseInvoicePaymentError('Purchase invoice not found', 404);

        return { payment, purchaseInvoice };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return success({
      payment: normalizePurchaseInvoicePayment(result.payment),
      purchaseInvoice: normalizePurchaseInvoice(result.purchaseInvoice),
    });
  } catch (error) {
    if (isTransactionConflictError(error)) {
      return failure('Payment balance changed; refresh and try again', 409);
    }

    return handleApiError(error);
  }
}
