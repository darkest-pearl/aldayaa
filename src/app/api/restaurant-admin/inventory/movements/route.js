export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import {
  calculateStockAfterMovement,
  isValidInventoryMovementType,
  normalizeInventoryItem,
  normalizeInventoryMovement,
} from '../../../../../lib/inventory';
import { prisma } from '../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';
import { TENANT_AUDIT_ACTIONS, createTenantAuditLog } from '../../../../../lib/tenant-audit';

const movementSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  itemId: z.string().trim().min(1),
  type: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  reason: z.string().trim().max(500).optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
});

class TenantInventoryMovementError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const { searchParams } = new URL(request.url);
    const itemId = (searchParams.get('itemId') || '').trim();

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        restaurantId: staff.restaurantId,
        ...(itemId ? { itemId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { item: true },
    });

    return success({
      movements: movements.map(normalizeInventoryMovement),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = movementSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid inventory movement payload', 400, { details: parsed.error.flatten() });
    }

    if (!isValidInventoryMovementType(parsed.data.type)) {
      return failure('Invalid inventory movement type', 400);
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const { updatedItem, movement } = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: parsed.data.itemId, restaurantId: staff.restaurantId, isActive: true },
      });

      if (!item) {
        throw new TenantInventoryMovementError('Inventory item is not available', 404);
      }

      const resultingStock = calculateStockAfterMovement(item.currentStock, parsed.data.type, parsed.data.quantity);
      if (resultingStock < 0) {
        throw new TenantInventoryMovementError('Inventory movement cannot reduce stock below zero', 400);
      }

      const updated = await tx.inventoryItem.updateMany({
        where: { id: item.id, restaurantId: staff.restaurantId },
        data: { currentStock: resultingStock },
      });

      if (updated.count !== 1) {
        throw new TenantInventoryMovementError('Inventory item is not available', 404);
      }

      const updatedItem = await tx.inventoryItem.findFirst({
        where: { id: item.id, restaurantId: staff.restaurantId },
      });

      if (!updatedItem) {
        throw new TenantInventoryMovementError('Inventory item is not available', 404);
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          restaurantId: staff.restaurantId,
          itemId: item.id,
          type: parsed.data.type,
          quantity: parsed.data.quantity,
          reason: normalizeOptionalText(parsed.data.reason),
          source: normalizeOptionalText(parsed.data.source),
          createdByAdminId: staff.id,
          createdByAdminEmail: staff.email,
        },
        include: { item: true },
      });

      return { updatedItem, movement };
    });

    await createTenantAuditLog({
      staff,
      request,
      action: TENANT_AUDIT_ACTIONS.INVENTORY_MOVEMENT_CREATED,
      entityType: 'INVENTORY_MOVEMENT',
      entityId: movement.id,
      summary: `Created ${movement.type} movement for ${movement.item?.name || movement.itemId}`,
      metadata: {
        itemId: movement.itemId,
        itemName: movement.item?.name,
        type: movement.type,
        quantity: movement.quantity,
        resultingStock: updatedItem.currentStock,
      },
    });

    return success({
      item: normalizeInventoryItem(updatedItem),
      movement: normalizeInventoryMovement(movement),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
