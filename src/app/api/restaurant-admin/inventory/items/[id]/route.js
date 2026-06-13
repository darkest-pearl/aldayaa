export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../../lib/api-response';
import { normalizeInventoryItem, normalizeInventoryUnit } from '../../../../../../lib/inventory';
import { prisma } from '../../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../../lib/restaurant-staff-access';
import { TENANT_AUDIT_ACTIONS, createTenantAuditLog } from '../../../../../../lib/tenant-audit';

const updateSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  sku: z.string().trim().max(80).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  unit: z.string().trim().min(1).max(40).optional(),
  currentStock: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).optional().nullable(),
  costPerUnit: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

function cleanOptionalSku(value) {
  return normalizeOptionalText(value);
}

function buildUpdateData(data) {
  const update = {};
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.sku !== undefined) update.sku = cleanOptionalSku(data.sku);
  if (data.category !== undefined) update.category = normalizeOptionalText(data.category);
  if (data.unit !== undefined) update.unit = normalizeInventoryUnit(data.unit);
  if (data.currentStock !== undefined) update.currentStock = data.currentStock;
  if (data.reorderLevel !== undefined) update.reorderLevel = data.reorderLevel ?? null;
  if (data.costPerUnit !== undefined) update.costPerUnit = data.costPerUnit ?? null;
  if (data.isActive !== undefined) update.isActive = data.isActive;
  if (data.notes !== undefined) update.notes = normalizeOptionalText(data.notes);
  return update;
}

async function readTenantItem(id, restaurantId) {
  const item = await prisma.inventoryItem.findFirst({
    where: { id, restaurantId },
  });
  return item;
}

function isPrismaUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid inventory item payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existing = await readTenantItem(params.id, staff.restaurantId);
    if (!existing) return failure('Inventory item not found', 404);

    const data = buildUpdateData(parsed.data);
    if (data.sku && data.sku !== existing.sku) {
      const existingSku = await prisma.inventoryItem.findFirst({
        where: {
          sku: data.sku,
          restaurantId: staff.restaurantId,
          NOT: { id: params.id },
        },
        select: { id: true },
      });
      if (existingSku) return failure('Inventory SKU is already in use', 409);
    }

    let updated;
    try {
      updated = await prisma.inventoryItem.updateMany({
        where: { id: params.id, restaurantId: staff.restaurantId },
        data,
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return failure('Inventory SKU is unavailable', 409);
      }
      throw error;
    }

    if (updated.count !== 1) {
      return failure('Inventory item not found', 404);
    }

    const item = await prisma.inventoryItem.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
    });
    if (!item) return failure('Inventory item not found', 404);

    await createTenantAuditLog({
      staff,
      request,
      action: TENANT_AUDIT_ACTIONS.INVENTORY_ITEM_UPDATED,
      entityType: 'INVENTORY_ITEM',
      entityId: item.id,
      summary: `Updated inventory item ${item.name}`,
      metadata: {
        name: item.name,
        sku: item.sku,
        updatedFields: Object.keys(data),
        beforeActive: existing.isActive,
        afterActive: item.isActive,
      },
    });

    return success({ item: normalizeInventoryItem(item) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug, { write: true });
    const updated = await prisma.inventoryItem.updateMany({
      where: { id: params.id, restaurantId: staff.restaurantId },
      data: { isActive: false },
    });

    if (updated.count !== 1) {
      return failure('Inventory item not found', 404);
    }

    const item = await prisma.inventoryItem.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
    });
    if (!item) return failure('Inventory item not found', 404);

    await createTenantAuditLog({
      staff,
      request,
      action: TENANT_AUDIT_ACTIONS.INVENTORY_ITEM_UPDATED,
      entityType: 'INVENTORY_ITEM',
      entityId: item.id,
      summary: `Deactivated inventory item ${item.name}`,
      metadata: {
        name: item.name,
        sku: item.sku,
        beforeActive: true,
        afterActive: item.isActive,
      },
    });

    return success({ item: normalizeInventoryItem(item) });
  } catch (error) {
    return handleApiError(error);
  }
}
