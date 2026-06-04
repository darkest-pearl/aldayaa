export const dynamic = "force-dynamic";
import { requireAdmin } from '../../../../../lib/auth';
import { handleApiError, success } from '../../../../../lib/api-response';
import { FEATURE_KEYS } from '../../../../../lib/features';
import { normalizeInventoryItem } from '../../../../../lib/inventory';
import { requireFeatureEnabled } from '../../../../../lib/module-access';
import { prisma } from '../../../../../lib/prisma';
import { getRestaurantProfile } from '../../../../../lib/restaurant-profile';
import { getDemoRestaurantFilter, withDemoRestaurantWhere } from '../../../../../lib/restaurants';
import {
  getMenuItemIngredientCount,
  hasRecipeMapping,
  normalizeMenuItemIngredient,
} from '../../../../../lib/recipes';

async function requireRecipeFeature(request, roles) {
  await requireAdmin(request, roles);
  const profile = await getRestaurantProfile({ fallbackOnError: false });
  requireFeatureEnabled(profile, FEATURE_KEYS.RECIPE_CONSUMPTION);
}

function normalizeMenuItem(item = {}) {
  const ingredients = (item.ingredients || []).map(normalizeMenuItemIngredient);
  const ingredientCount = getMenuItemIngredientCount({ ...item, ingredients });

  return {
    id: item.id,
    name: item.name || '',
    description: item.description || '',
    price: Number(item.price || 0),
    isAvailable: item.isAvailable !== false,
    categoryId: item.categoryId,
    categoryName: item.category?.name || null,
    ingredientCount,
    hasRecipeMapping: hasRecipeMapping({ ...item, ingredientCount }),
    ingredients,
  };
}

export async function GET(request) {
  try {
    await requireRecipeFeature(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const [menuItems, inventoryItems] = await Promise.all([
      prisma.menuItem.findMany({
        where: withDemoRestaurantWhere(),
        orderBy: { name: 'asc' },
        include: {
          category: true,
          ingredients: {
            where: getDemoRestaurantFilter(),
            include: { inventoryItem: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.inventoryItem.findMany({
        where: withDemoRestaurantWhere({ isActive: true }),
        orderBy: { name: 'asc' },
      }),
    ]);

    return success({
      menuItems: menuItems.map(normalizeMenuItem),
      inventoryItems: inventoryItems.map(normalizeInventoryItem),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
