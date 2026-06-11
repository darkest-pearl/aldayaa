export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../../lib/api-response';
import {
  INVENTORY_MOVEMENT_TYPES,
  normalizeInventoryItem,
  normalizeInventoryMovement,
} from '../../../../../../lib/inventory';
import {
  PURCHASE_REQUEST_STATUSES,
  normalizePurchaseRequest,
} from '../../../../../../lib/purchase-requests';
import { prisma } from '../../../../../../lib/prisma';
import { requireRestaurantStaffAccess } from '../../../../../../lib/restaurant-staff-access';

const PURCHASE_REQUEST_RECEIVE_SOURCE = 'PURCHASE_REQUEST_RECEIVE';

const receivePurchaseRequestSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
});

class TenantPurchaseReceiveError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getRequiredByInventoryItemId(lines = []) {
  const requiredByInventoryItemId = new Map();

  for (const line of lines) {
    const quantity = toNumber(line.quantity);
    requiredByInventoryItemId.set(
      line.inventoryItemId,
      toNumber(requiredByInventoryItemId.get(line.inventoryItemId)) + quantity,
    );
  }

  return requiredByInventoryItemId;
}

function validatePurchaseRequestForReceiving(purchaseRequest, staff) {
  if (!purchaseRequest) {
    throw new TenantPurchaseReceiveError('Purchase request not found', 404);
  }

  if (purchaseRequest.status === PURCHASE_REQUEST_STATUSES.CANCELLED) {
    throw new TenantPurchaseReceiveError('Cancelled purchase requests cannot be received', 400);
  }

  if (purchaseRequest.status === PURCHASE_REQUEST_STATUSES.RECEIVED) {
    throw new TenantPurchaseReceiveError('Purchase request has already been received', 409);
  }

  if (purchaseRequest.lines.length === 0) {
    throw new TenantPurchaseReceiveError('Purchase request has no line items to receive', 400);
  }

  if (!purchaseRequest.lines.every((line) => line.restaurantId === staff.restaurantId)) {
    throw new TenantPurchaseReceiveError('Purchase request lines are not available for this tenant', 400);
  }

  for (const line of purchaseRequest.lines) {
    if (toNumber(line.quantity) <= 0) {
      throw new TenantPurchaseReceiveError('Purchase request line quantity must be positive', 400);
    }
  }
}

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const parsed = receivePurchaseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid purchase receive payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const { receivedPurchaseRequest, movements, updatedItems } = await prisma.$transaction(async (tx) => {
      const purchaseRequest = await tx.purchaseRequest.findFirst({
        where: { id: params.id, restaurantId: staff.restaurantId },
        include: {
          supplier: true,
          lines: {
            orderBy: { createdAt: 'asc' },
            include: { inventoryItem: true },
          },
        },
      });

      validatePurchaseRequestForReceiving(purchaseRequest, staff);

      const requestUpdated = await tx.purchaseRequest.updateMany({
        where: {
          id: params.id,
          restaurantId: staff.restaurantId,
          status: { notIn: [PURCHASE_REQUEST_STATUSES.RECEIVED, PURCHASE_REQUEST_STATUSES.CANCELLED] },
        },
        data: { status: PURCHASE_REQUEST_STATUSES.RECEIVED },
      });

      if (requestUpdated.count !== 1) {
        throw new TenantPurchaseReceiveError('Purchase request has already been received', 409);
      }

      const inventoryItemIds = [
        ...new Set(purchaseRequest.lines.map((line) => line.inventoryItemId).filter(Boolean)),
      ];
      const inventoryItems = await tx.inventoryItem.findMany({
        where: {
          id: { in: inventoryItemIds },
          restaurantId: staff.restaurantId,
          isActive: true,
        },
      });
      const inventoryItemsById = new Map(inventoryItems.map((item) => [item.id, item]));

      for (const line of purchaseRequest.lines) {
        if (!inventoryItemsById.has(line.inventoryItemId)) {
          throw new TenantPurchaseReceiveError('Inventory item is not available for receiving', 404);
        }
      }

      const requiredByInventoryItemId = getRequiredByInventoryItemId(purchaseRequest.lines);
      const updatedItems = [];
      for (const [inventoryItemId, quantity] of requiredByInventoryItemId) {
        const updated = await tx.inventoryItem.updateMany({
          where: { id: inventoryItemId, restaurantId: staff.restaurantId, isActive: true },
          data: { currentStock: { increment: quantity } },
        });

        if (updated.count !== 1) {
          throw new TenantPurchaseReceiveError('Inventory item is not available for receiving', 404);
        }

        const updatedItem = await tx.inventoryItem.findFirst({
          where: { id: inventoryItemId, restaurantId: staff.restaurantId },
        });

        if (!updatedItem) {
          throw new TenantPurchaseReceiveError('Inventory item is not available for receiving', 404);
        }

        updatedItems.push(updatedItem);
      }

      const movements = [];
      for (const line of purchaseRequest.lines) {
        const movement = await tx.inventoryMovement.create({
          data: {
            restaurantId: staff.restaurantId,
            itemId: line.inventoryItemId,
            type: INVENTORY_MOVEMENT_TYPES.STOCK_IN,
            quantity: toNumber(line.quantity),
            reason: `Purchase request ${purchaseRequest.reference} received`,
            source: PURCHASE_REQUEST_RECEIVE_SOURCE,
            createdByAdminId: staff.id,
            createdByAdminEmail: staff.email,
          },
          include: { item: true },
        });

        movements.push(movement);
      }

      const receivedPurchaseRequest = await tx.purchaseRequest.findFirst({
        where: { id: params.id, restaurantId: staff.restaurantId },
        include: {
          supplier: true,
          lines: {
            orderBy: { createdAt: 'asc' },
            include: { inventoryItem: true },
          },
        },
      });

      if (!receivedPurchaseRequest) {
        throw new TenantPurchaseReceiveError('Purchase request not found', 404);
      }

      return { receivedPurchaseRequest, movements, updatedItems };
    });

    return success({
      purchaseRequest: normalizePurchaseRequest(receivedPurchaseRequest),
      movements: movements.map(normalizeInventoryMovement),
      items: updatedItems.map(normalizeInventoryItem),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
