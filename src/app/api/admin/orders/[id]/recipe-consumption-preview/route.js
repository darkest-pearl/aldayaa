export const dynamic = "force-dynamic";
import { requireAdmin } from '../../../../../../lib/auth';
import { failure, handleApiError, success } from '../../../../../../lib/api-response';
import { FEATURE_KEYS } from '../../../../../../lib/features';
import { requireFeatureEnabled } from '../../../../../../lib/module-access';
import { prisma } from '../../../../../../lib/prisma';
import { getRestaurantProfile } from '../../../../../../lib/restaurant-profile';
import { calculateRecipeConsumptionForOrder } from '../../../../../../lib/recipes';

export async function GET(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const profile = await getRestaurantProfile();
    requireFeatureEnabled(profile, FEATURE_KEYS.RECIPE_CONSUMPTION);

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        recipeConsumptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      return failure('Order not found', 404);
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

    return success({
      order: {
        id: order.id,
        reference: order.reference,
        name: order.name,
        createdAt: order.createdAt,
      },
      consumption: calculateRecipeConsumptionForOrder(orderWithRecipeIngredients),
      appliedConsumption: order.recipeConsumptions?.[0] || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
