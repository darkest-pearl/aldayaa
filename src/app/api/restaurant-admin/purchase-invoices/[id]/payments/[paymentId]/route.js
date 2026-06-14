export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../../../lib/api-response';
import {
  PURCHASE_INVOICE_PAYMENT_STATUSES,
  PURCHASE_INVOICE_STATUSES,
  normalizePurchaseInvoice,
} from '../../../../../../../lib/purchase-invoices';
import { prisma } from '../../../../../../../lib/prisma';
import {
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../../../lib/restaurant-staff-access';
import { TENANT_AUDIT_ACTIONS, createTenantAuditLog } from '../../../../../../../lib/tenant-audit';

const voidPurchaseInvoicePaymentSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  status: z.string().trim().optional(),
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

function getRequestedStatus(data) {
  return normalizeOptionalText(data.status)?.toUpperCase() || PURCHASE_INVOICE_PAYMENT_STATUSES.VOID;
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = voidPurchaseInvoicePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid purchase invoice payment payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const requestedStatus = getRequestedStatus(parsed.data);
    if (requestedStatus !== PURCHASE_INVOICE_PAYMENT_STATUSES.VOID) {
      return failure('Purchase invoice payments can only be voided', 400);
    }

    const invoice = await prisma.purchaseInvoice.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true, status: true },
    });

    if (!invoice) return failure('Purchase invoice not found', 404);
    if (invoice.status === PURCHASE_INVOICE_STATUSES.DRAFT) {
      return failure('Draft purchase invoices cannot void payments', 400);
    }
    if (invoice.status === PURCHASE_INVOICE_STATUSES.VOID) {
      return failure('Void purchase invoices cannot void payments', 400);
    }

    const updated = await prisma.purchaseInvoicePayment.updateMany({
      where: {
        id: params.paymentId,
        purchaseInvoiceId: params.id,
        restaurantId: staff.restaurantId,
        status: PURCHASE_INVOICE_PAYMENT_STATUSES.RECORDED,
      },
      data: {
        status: PURCHASE_INVOICE_PAYMENT_STATUSES.VOID,
      },
    });

    if (updated.count !== 1) {
      return failure('Purchase invoice payment not found', 404);
    }

    const purchaseInvoice = await prisma.purchaseInvoice.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      include: purchaseInvoiceInclude,
    });

    if (!purchaseInvoice) return failure('Purchase invoice not found', 404);

    const payment = await prisma.purchaseInvoicePayment.findFirst({
      where: {
        id: params.paymentId,
        purchaseInvoiceId: params.id,
        restaurantId: staff.restaurantId,
      },
    });

    await createTenantAuditLog({
      staff,
      request,
      action: TENANT_AUDIT_ACTIONS.PURCHASE_INVOICE_PAYMENT_VOIDED,
      entityType: 'PURCHASE_INVOICE_PAYMENT',
      entityId: params.paymentId,
      summary: `Voided purchase invoice payment for invoice ${purchaseInvoice.invoiceNumber}`,
      metadata: {
        purchaseInvoiceId: purchaseInvoice.id,
        invoiceNumber: purchaseInvoice.invoiceNumber,
        amount: payment?.amount,
        currency: payment?.currency,
        method: payment?.method,
      },
    });

    return success({ purchaseInvoice: normalizePurchaseInvoice(purchaseInvoice) });
  } catch (error) {
    return handleApiError(error);
  }
}
