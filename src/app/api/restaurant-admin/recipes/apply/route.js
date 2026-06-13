export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import {
  INVENTORY_MOVEMENT_TYPES,
  normalizeInventoryItem,
  normalizeInventoryMovement,
} from '../../../../../lib/inventory';
import { prisma } from '../../../../../lib/prisma';
import {
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';
import { calculateRecipeConsumptionForOrder } from '../../../../../lib/recipes';
import { TENANT_AUDIT_ACTIONS, createTenantAuditLog } from '../../../../../lib/tenant-audit';

const APPLIED_CONSUMPTION_STATUS = 'APPLIED';
const ORDER_RECIPE_CONSUMPTION_SOURCE = 'ORDER_RECIPE_CONSUMPTION';

const applySchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  notes: z.string().trim().max(500).optional().nullable(),
});

class TenantRecipeConsumptionApplyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeApplyOrder(order = {}) {
  return {
    reference: order.reference || '',
    status: order.status || '',
    createdAt: order.createdAt,
    orderContext: order.orderContext || 'STANDARD',
    orderSource: order.orderSource || 'CUSTOMER',
    tableLabel: order.tableLabel || null,
    tableSlug: order.tableSlug || null,
  };
}

function normalizeAppliedConsumption(log = {}) {
  return {
    id: log.id,
    status: log.status || APPLIED_CONSUMPTION_STATUS,
    notes: log.notes || null,
    appliedByAdminEmail: log.appliedByAdminEmail || null,
    createdAt: log.createdAt,
  };
}

function normalizeConsumption(consumption = {}) {
  return {
    reference: consumption.reference || null,
    lines: consumption.lines || [],
    missingMappings: consumption.missingMappings || [],
    hasMissingMappings: Boolean(consumption.hasMissingMappings),
    totalLines: consumption.totalLines || 0,
  };
}

function getMenuItemIds(orderItems = []) {
  return [...new Set(orderItems.map((item) => item.menuItemId || item.itemId).filter(Boolean))];
}

function groupIngredientsByMenuItemId(recipeIngredients = [], inventoryById = new Map()) {
  const ingredientsByMenuItemId = new Map();

  for (const ingredient of recipeIngredients) {
    const current = ingredientsByMenuItemId.get(ingredient.menuItemId) || [];
    current.push({
      ...ingredient,
      inventoryItem: inventoryById.get(ingredient.inventoryItemId) || null,
    });
    ingredientsByMenuItemId.set(ingredient.menuItemId, current);
  }

  return ingredientsByMenuItemId;
}

function buildOrderWithRecipeIngredients(order, recipeIngredients, inventoryItems) {
  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));
  const ingredientsByMenuItemId = groupIngredientsByMenuItemId(recipeIngredients, inventoryById);

  return {
    ...order,
    items: (order.items || []).map((item) => {
      const menuItemId = item.menuItemId || item.itemId;
      return {
        ...item,
        recipeIngredients: menuItemId ? ingredientsByMenuItemId.get(menuItemId) || [] : [],
      };
    }),
  };
}

function getConsumptionLines(consumption = {}) {
  return (consumption.lines || []).filter((line) => !line.missingMapping && line.inventoryItemId);
}

function getRequiredByInventoryItemId(consumptionLines = []) {
  const requiredByInventoryItemId = new Map();

  for (const line of consumptionLines) {
    requiredByInventoryItemId.set(
      line.inventoryItemId,
      toNumber(requiredByInventoryItemId.get(line.inventoryItemId)) + toNumber(line.totalRequiredQuantity),
    );
  }

  return requiredByInventoryItemId;
}

function ensureInventoryCanCoverConsumption(inventoryItemIds, inventoryItemsById, requiredByInventoryItemId) {
  for (const inventoryItemId of inventoryItemIds) {
    const item = inventoryItemsById.get(inventoryItemId);
    const requiredQuantity = toNumber(requiredByInventoryItemId.get(inventoryItemId));

    if (!item || item.isActive === false) {
      throw new TenantRecipeConsumptionApplyError('Inventory item is not available for recipe consumption', 400);
    }

    if (toNumber(item.currentStock) < requiredQuantity) {
      throw new TenantRecipeConsumptionApplyError('Recipe consumption cannot reduce stock below zero', 400);
    }
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid recipe consumption apply payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const { order, consumption, appliedConsumption, movements, updatedItems } = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: parsed.data.orderId, restaurantId: staff.restaurantId },
        include: {
          items: {
            where: { restaurantId: staff.restaurantId },
            orderBy: { id: 'asc' },
          },
        },
      });

      if (!order) {
        throw new TenantRecipeConsumptionApplyError('Order not found', 404);
      }

      const existingApplication = await tx.orderRecipeConsumption.findFirst({
        where: { restaurantId: staff.restaurantId, orderId: order.id, status: APPLIED_CONSUMPTION_STATUS },
      });

      if (existingApplication) {
        throw new TenantRecipeConsumptionApplyError('Recipe consumption has already been applied for this order', 409);
      }

      const menuItemIds = getMenuItemIds(order.items || []);
      const recipeIngredients = menuItemIds.length
        ? await tx.menuItemIngredient.findMany({
            where: {
              restaurantId: staff.restaurantId,
              menuItemId: { in: menuItemIds },
            },
            orderBy: { createdAt: 'asc' },
          })
        : [];
      const inventoryItemIds = [
        ...new Set(recipeIngredients.map((ingredient) => ingredient.inventoryItemId).filter(Boolean)),
      ];
      const inventoryItems = inventoryItemIds.length
        ? await tx.inventoryItem.findMany({
            where: {
              id: { in: inventoryItemIds },
              restaurantId: staff.restaurantId,
            },
          })
        : [];
      const orderWithRecipeIngredients = buildOrderWithRecipeIngredients(order, recipeIngredients, inventoryItems);
      const consumption = normalizeConsumption(calculateRecipeConsumptionForOrder(orderWithRecipeIngredients));

      if (consumption.hasMissingMappings) {
        throw new TenantRecipeConsumptionApplyError('Recipe mappings are incomplete for this order', 400);
      }

      const consumptionLines = getConsumptionLines(consumption);
      if (!consumptionLines.length) {
        throw new TenantRecipeConsumptionApplyError('No recipe consumption lines are available for this order', 400);
      }

      const consumedInventoryItemIds = [...new Set(consumptionLines.map((line) => line.inventoryItemId))];
      const inventoryItemsById = new Map(inventoryItems.map((item) => [item.id, item]));
      const requiredByInventoryItemId = getRequiredByInventoryItemId(consumptionLines);
      ensureInventoryCanCoverConsumption(consumedInventoryItemIds, inventoryItemsById, requiredByInventoryItemId);

      const appliedConsumption = await tx.orderRecipeConsumption.create({
        data: {
          orderId: order.id,
          status: APPLIED_CONSUMPTION_STATUS,
          restaurantId: staff.restaurantId,
          appliedByAdminId: staff.id,
          appliedByAdminEmail: staff.email,
          notes: normalizeOptionalText(parsed.data.notes),
        },
      });

      const updatedItems = [];
      for (const inventoryItemId of consumedInventoryItemIds) {
        const requiredQuantity = toNumber(requiredByInventoryItemId.get(inventoryItemId));
        const updated = await tx.inventoryItem.updateMany({
          where: {
            id: inventoryItemId,
            restaurantId: staff.restaurantId,
            isActive: true,
            currentStock: { gte: requiredQuantity },
          },
          data: { currentStock: { decrement: requiredQuantity } },
        });

        if (updated.count !== 1) {
          throw new TenantRecipeConsumptionApplyError('Recipe consumption cannot reduce stock below zero', 400);
        }

        const updatedItem = await tx.inventoryItem.findFirst({
          where: { id: inventoryItemId, restaurantId: staff.restaurantId },
        });

        if (!updatedItem) {
          throw new TenantRecipeConsumptionApplyError('Inventory item is not available for recipe consumption', 400);
        }

        updatedItems.push(updatedItem);
      }

      const reason = `Recipe consumption for order ${order.reference || order.id}`;
      const movements = [];
      for (const line of consumptionLines) {
        const movement = await tx.inventoryMovement.create({
          data: {
            restaurantId: staff.restaurantId,
            itemId: line.inventoryItemId,
            type: INVENTORY_MOVEMENT_TYPES.STOCK_OUT,
            quantity: toNumber(line.totalRequiredQuantity),
            reason,
            source: ORDER_RECIPE_CONSUMPTION_SOURCE,
            createdByAdminId: staff.id,
            createdByAdminEmail: staff.email,
          },
          include: { item: true },
        });
        movements.push(movement);
      }

      return { order, consumption, appliedConsumption, movements, updatedItems };
    });

    await createTenantAuditLog({
      staff,
      request,
      action: TENANT_AUDIT_ACTIONS.RECIPE_CONSUMPTION_APPLIED,
      entityType: 'ORDER_RECIPE_CONSUMPTION',
      entityId: appliedConsumption.id,
      summary: `Applied recipe consumption for order ${order.reference || order.id}`,
      metadata: {
        orderId: order.id,
        orderReference: order.reference,
        movementCount: movements.length,
        updatedItemCount: updatedItems.length,
      },
    });

    return success({
      order: normalizeApplyOrder(order),
      consumption,
      appliedConsumption: normalizeAppliedConsumption(appliedConsumption),
      movements: movements.map(normalizeInventoryMovement),
      items: updatedItems.map(normalizeInventoryItem),
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return failure('Recipe consumption has already been applied for this order', 409);
    }

    return handleApiError(error);
  }
}
