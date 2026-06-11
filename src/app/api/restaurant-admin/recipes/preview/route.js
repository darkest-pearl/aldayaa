export const dynamic = 'force-dynamic';

import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  isRestaurantStaffWriteRole,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';
import { calculateRecipeConsumptionForOrder } from '../../../../../lib/recipes';

const APPLIED_CONSUMPTION_STATUS = 'APPLIED';

function getOrderIdFromRequest(request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get('orderId')?.trim() || '';
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

function normalizePreviewOrder(order = {}) {
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

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

function getBlockingReasons(consumption, inventoryById, alreadyApplied) {
  const blockingReasons = [];

  if (alreadyApplied) {
    blockingReasons.push('Recipe consumption has already been applied for this order.');
  }

  if (consumption.hasMissingMappings) {
    blockingReasons.push('Recipe mappings are incomplete for this order.');
  }

  const consumptionLines = getConsumptionLines(consumption);
  if (!consumptionLines.length && !consumption.hasMissingMappings) {
    blockingReasons.push('No recipe consumption lines are available for this order.');
  }

  const requiredByInventoryItemId = getRequiredByInventoryItemId(consumptionLines);
  for (const [inventoryItemId, requiredQuantity] of requiredByInventoryItemId.entries()) {
    const item = inventoryById.get(inventoryItemId);
    if (!item || item.isActive === false) {
      blockingReasons.push('Inventory item is not available for recipe consumption.');
      continue;
    }

    if (toNumber(item.currentStock) < toNumber(requiredQuantity)) {
      blockingReasons.push('Recipe consumption cannot reduce stock below zero.');
    }
  }

  return [...new Set(blockingReasons)];
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const orderId = getOrderIdFromRequest(request);
    if (!orderId) return failure('orderId is required', 400);

    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId: staff.restaurantId },
      include: {
        items: {
          where: { restaurantId: staff.restaurantId },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!order) return failure('Order not found', 404);

    const menuItemIds = [
      ...new Set((order.items || []).map((item) => item.menuItemId || item.itemId).filter(Boolean)),
    ];

    const recipeIngredients = menuItemIds.length
      ? await prisma.menuItemIngredient.findMany({
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
      ? await prisma.inventoryItem.findMany({
          where: {
            id: { in: inventoryItemIds },
            restaurantId: staff.restaurantId,
          },
        })
      : [];
    const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));
    const ingredientsByMenuItemId = groupIngredientsByMenuItemId(recipeIngredients, inventoryById);
    const orderWithRecipeIngredients = {
      ...order,
      items: (order.items || []).map((item) => {
        const menuItemId = item.menuItemId || item.itemId;
        return {
          ...item,
          recipeIngredients: menuItemId ? ingredientsByMenuItemId.get(menuItemId) || [] : [],
        };
      }),
    };
    const rawConsumption = calculateRecipeConsumptionForOrder(orderWithRecipeIngredients);
    const alreadyApplied = Boolean(await prisma.orderRecipeConsumption.findFirst({
      where: { restaurantId: staff.restaurantId, orderId: order.id, status: APPLIED_CONSUMPTION_STATUS },
      select: { id: true },
    }));
    const blockingReasons = getBlockingReasons(rawConsumption, inventoryById, alreadyApplied);
    const canApply = isRestaurantStaffWriteRole(staff.role) && blockingReasons.length === 0;
    const consumption = {
      reference: rawConsumption.reference,
      lines: rawConsumption.lines,
      missingMappings: rawConsumption.missingMappings,
      hasMissingMappings: rawConsumption.hasMissingMappings,
      totalLines: rawConsumption.totalLines,
      alreadyApplied,
      canApply,
      blockingReasons,
    };

    return success({
      order: normalizePreviewOrder(order),
      consumption,
      alreadyApplied,
      canApply,
      blockingReasons,
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
