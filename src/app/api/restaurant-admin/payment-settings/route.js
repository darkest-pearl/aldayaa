export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../lib/api-response';
import {
  PAYMENT_SETTING_MODES,
  PAYMENT_SETTING_PROVIDERS,
  assertSafePaymentSettingsPayload,
  normalizePaymentSettings,
  serializePaymentSettings,
} from '../../../../lib/payment-settings';
import { prisma } from '../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';
import { TENANT_AUDIT_ACTIONS, createTenantAuditLog } from '../../../../lib/tenant-audit';

const paymentSettingsSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  paymentMode: z.enum(Object.values(PAYMENT_SETTING_MODES)).optional(),
  provider: z.enum(Object.values(PAYMENT_SETTING_PROVIDERS)).optional(),
  onlineOrderPaymentsEnabled: z.boolean().optional(),
  subscriptionBillingEnabled: z.boolean().optional(),
  refundsEnabled: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  publicKeyConfigured: z.boolean().optional(),
  webhookConfigured: z.boolean().optional(),
});

async function loadTenantSettings(staff) {
  return prisma.restaurantSettings.findUnique({
    where: { restaurantId: staff.restaurantId },
    select: {
      id: true,
      paymentSettings: true,
    },
  });
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const settings = await loadTenantSettings(staff);

    if (!settings) {
      return failure('Restaurant settings are not initialized for this tenant', 404);
    }

    return success({
      paymentSettings: normalizePaymentSettings(settings.paymentSettings),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    if (body && body.restaurantId !== undefined) {
      return failure('Restaurant id cannot be set from payment settings payload', 400);
    }

    try {
      assertSafePaymentSettingsPayload(body);
    } catch (paymentSettingsError) {
      return failure(paymentSettingsError.message, 400);
    }

    const parsed = paymentSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid payment settings payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existingSettings = await loadTenantSettings(staff);

    if (!existingSettings) {
      return failure('Restaurant settings are not initialized for this tenant', 404);
    }

    const previousPaymentSettings = normalizePaymentSettings(existingSettings.paymentSettings);
    const nextPaymentSettings = normalizePaymentSettings({
      ...previousPaymentSettings,
      ...parsed.data,
      notes: parsed.data.notes === undefined ? previousPaymentSettings.notes : parsed.data.notes,
    });

    const updated = await prisma.restaurantSettings.updateMany({
      where: { restaurantId: staff.restaurantId },
      data: {
        paymentSettings: serializePaymentSettings(nextPaymentSettings),
      },
    });

    if (updated.count !== 1) {
      return failure('Restaurant settings are not initialized for this tenant', 404);
    }

    const settings = await loadTenantSettings(staff);
    const paymentSettings = normalizePaymentSettings(settings?.paymentSettings);

    await createTenantAuditLog({
      staff,
      request,
      action: TENANT_AUDIT_ACTIONS.PAYMENT_SETTINGS_UPDATED,
      entityType: 'PAYMENT_SETTINGS',
      entityId: String(existingSettings.id),
      summary: 'Updated tenant payment settings',
      metadata: {
        beforeMode: previousPaymentSettings.paymentMode,
        afterMode: paymentSettings.paymentMode,
        beforeProvider: previousPaymentSettings.provider,
        afterProvider: paymentSettings.provider,
        onlineOrderPaymentsEnabled: paymentSettings.onlineOrderPaymentsEnabled,
        subscriptionBillingEnabled: paymentSettings.subscriptionBillingEnabled,
        refundsEnabled: paymentSettings.refundsEnabled,
        publicKeyConfigured: paymentSettings.publicKeyConfigured,
        webhookConfigured: paymentSettings.webhookConfigured,
      },
    });

    return success({ paymentSettings });
  } catch (error) {
    return handleApiError(error);
  }
}
