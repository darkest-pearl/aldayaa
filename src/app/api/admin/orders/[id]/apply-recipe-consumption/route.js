export const dynamic = "force-dynamic";
import { z } from 'zod';
import { requireAdmin } from '../../../../../../lib/auth';
import { failure, handleApiError, success } from '../../../../../../lib/api-response';
import { FEATURE_KEYS } from '../../../../../../lib/features';
import {
  INVENTORY_MOVEMENT_TYPES,
  normalizeInventoryItem,
  normalizeInventoryMovement,
} from '../../../../../../lib/inventory';
import { requireFeatureEnabled } from '../../../../../../lib/module-access';
import { prisma } from '../../../../../../lib/prisma';
import { getRestaurantProfile } from '../../../../../../lib/restaurant-profile';
import { calculateRecipeConsumptionForOrder } from '../../../../../../lib/recipes';

const applySchema = z.object({
  notes: z.string().trim().max(500).optional().nullable(),
});

class RecipeConsumptionApplyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function cleanOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

async function requireRecipeConsumptionApplyAccess(request) {
  const admin = await requireAdmin(request, ['ADMIN', 'MANAGER']);
  const profile = await getRestaurantProfile({ fallbackOnError: false });
  requireFeatureEnabled(profile, FEATURE_KEYS.RECIPE_CONSUMPTION);
  requireFeatureEnabled(profile, FEATURE_KEYS.INVENTORY);
  return admin;
}

async function loadOrderWithRecipeIngredients(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    return null;
  }

  const menuItemIds = [
    ...new Set((order.items || []).map((item) => item.menuItemId || item.itemId).filter(Boolean)),
  ];

  const recipeIngredients = menuItemIds.length
    ? await prisma.menuItemIngredient.findMany({
        where: { menuItemId: { in: menuItemIds } },
        include: { inventoryItem: true },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const ingredientsByMenuItemId = new Map();
  for (const ingredient of recipeIngredients) {
    const current = ingredientsByMenuItemId.get(ingredient.menuItemId) || [];
    current.push(ingredient);
    ingredientsByMenuItemId.set(ingredient.menuItemId, current);
  }

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

function getConsumptionLines(consumption) {
  return (consumption.lines || []).filter((line) => !line.missingMapping && line.inventoryItemId);
}

export async function POST(request, { params }) {
  try {
    const admin = await requireRecipeConsumptionApplyAccess(request);
    const body = await readJsonBody(request);
    const parsed = applySchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid recipe consumption payload', 400, { details: parsed.error.flatten() });
    }

    const order = await loadOrderWithRecipeIngredients(params.id);
    if (!order) {
      return failure('Order not found', 404);
    }

    const consumption = calculateRecipeConsumptionForOrder(order);

    if (consumption.hasMissingMappings) {
      return failure('Recipe mappings are incomplete for this order', 400, {
        consumption,
      });
    }

    const consumptionLines = getConsumptionLines(consumption);
    if (!consumptionLines.length) {
      return failure('No recipe consumption lines are available for this order', 400, {
        consumption,
      });
    }

    const inventoryItemIds = [...new Set(consumptionLines.map((line) => line.inventoryItemId))];
    const requiredByInventoryItemId = new Map();
    for (const line of consumptionLines) {
      requiredByInventoryItemId.set(
        line.inventoryItemId,
        toNumber(requiredByInventoryItemId.get(line.inventoryItemId)) + toNumber(line.totalRequiredQuantity),
      );
    }

    const { log, movements, updatedItems } = await prisma.$transaction(async (tx) => {
      const existingApplication = await tx.orderRecipeConsumption.findFirst({
        where: { orderId: order.id, status: 'APPLIED' },
      });

      if (existingApplication) {
        throw new RecipeConsumptionApplyError('Recipe consumption has already been applied for this order', 409);
      }

      const inventoryItems = await tx.inventoryItem.findMany({
        where: { id: { in: inventoryItemIds } },
      });
      const inventoryItemsById = new Map(inventoryItems.map((item) => [item.id, item]));

      for (const inventoryItemId of inventoryItemIds) {
        const item = inventoryItemsById.get(inventoryItemId);
        if (!item || item.isActive === false) {
          throw new RecipeConsumptionApplyError('Inventory item is not available for recipe consumption', 400);
        }
      }

      const movements = [];
      const reason = `Recipe consumption for order ${order.reference || order.id}`;

      for (const line of consumptionLines) {
        const movement = await tx.inventoryMovement.create({
          data: {
            itemId: line.inventoryItemId,
            type: INVENTORY_MOVEMENT_TYPES.STOCK_OUT,
            quantity: toNumber(line.totalRequiredQuantity),
            reason,
            source: 'ORDER_RECIPE_CONSUMPTION',
            createdByAdminId: admin.id,
            createdByAdminEmail: admin.email,
          },
          include: { item: true },
        });
        movements.push(movement);
      }

      const updatedItems = [];
      for (const inventoryItemId of inventoryItemIds) {
        const requiredQuantity = toNumber(requiredByInventoryItemId.get(inventoryItemId));
        const updateResult = await tx.inventoryItem.updateMany({
          where: {
            id: inventoryItemId,
            isActive: true,
            currentStock: { gte: requiredQuantity },
          },
          data: { currentStock: { decrement: requiredQuantity } },
        });

        if (updateResult.count !== 1) {
          throw new RecipeConsumptionApplyError('Recipe consumption cannot reduce stock below zero', 400);
        }

        const updatedItem = await tx.inventoryItem.findUnique({
          where: { id: inventoryItemId },
        });
        updatedItems.push(updatedItem);
      }

      const log = await tx.orderRecipeConsumption.create({
        data: {
          orderId: order.id,
          appliedByAdminId: admin.id,
          appliedByAdminEmail: admin.email,
          notes: cleanOptionalString(parsed.data.notes),
        },
      });

      return { log, movements, updatedItems };
    });

    return success({
      order: {
        id: order.id,
        reference: order.reference,
        name: order.name,
      },
      consumption,
      appliedConsumption: log,
      movements: movements.map(normalizeInventoryMovement),
      items: updatedItems.map(normalizeInventoryItem),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
