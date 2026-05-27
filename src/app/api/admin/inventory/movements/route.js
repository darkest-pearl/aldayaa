export const dynamic = "force-dynamic";
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/auth';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { FEATURE_KEYS } from '../../../../../lib/features';
import {
  calculateStockAfterMovement,
  isValidInventoryMovementType,
  normalizeInventoryItem,
  normalizeInventoryMovement,
} from '../../../../../lib/inventory';
import { requireFeatureEnabled } from '../../../../../lib/module-access';
import { prisma } from '../../../../../lib/prisma';
import { getRestaurantProfile } from '../../../../../lib/restaurant-profile';

const movementSchema = z.object({
  itemId: z.string().trim().min(1),
  type: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  reason: z.string().trim().max(500).optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
});

function cleanOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

class InventoryMovementError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function requireInventoryFeature(request, roles) {
  const admin = await requireAdmin(request, roles);
  const profile = await getRestaurantProfile({ fallbackOnError: false });
  requireFeatureEnabled(profile, FEATURE_KEYS.INVENTORY);
  return admin;
}

export async function GET(request) {
  try {
    await requireInventoryFeature(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const itemId = request.nextUrl?.searchParams?.get('itemId')?.trim();
    const movements = await prisma.inventoryMovement.findMany({
      where: itemId ? { itemId } : {},
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { item: true },
    });

    return success({ movements: movements.map(normalizeInventoryMovement) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const admin = await requireInventoryFeature(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = movementSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid inventory movement payload', 400, { details: parsed.error.flatten() });
    }

    if (!isValidInventoryMovementType(parsed.data.type)) {
      return failure('Invalid inventory movement type', 400);
    }

    const { updatedItem, movement } = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: parsed.data.itemId } });
      if (!item || item.isActive === false) {
        throw new InventoryMovementError('Inventory item is not available', 404);
      }

      const resultingStock = calculateStockAfterMovement(item.currentStock, parsed.data.type, parsed.data.quantity);
      if (resultingStock < 0) {
        throw new InventoryMovementError('Inventory movement cannot reduce stock below zero', 400);
      }

      const updatedItem = await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentStock: resultingStock },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          itemId: item.id,
          type: parsed.data.type,
          quantity: parsed.data.quantity,
          reason: cleanOptionalString(parsed.data.reason),
          source: cleanOptionalString(parsed.data.source),
          createdByAdminId: admin.id,
          createdByAdminEmail: admin.email,
        },
        include: { item: true },
      });

      return { updatedItem, movement };
    });

    return success({
      item: normalizeInventoryItem(updatedItem),
      movement: normalizeInventoryMovement(movement),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
