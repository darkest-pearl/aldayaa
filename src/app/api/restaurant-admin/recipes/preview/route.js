export const dynamic = 'force-dynamic';

import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';
import { calculateRecipeConsumptionForOrder } from '../../../../../lib/recipes';

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
    const consumption = {
      reference: rawConsumption.reference,
      lines: rawConsumption.lines,
      missingMappings: rawConsumption.missingMappings,
      hasMissingMappings: rawConsumption.hasMissingMappings,
      totalLines: rawConsumption.totalLines,
    };

    return success({
      order: normalizePreviewOrder(order),
      consumption,
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
