export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../lib/api-response';
import { normalizeInventoryItem } from '../../../../lib/inventory';
import { prisma } from '../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';
import {
  normalizeMenuItemRecipe,
  normalizeRecipeIngredientUnit,
  validateRecipeIngredientQuantity,
} from '../../../../lib/recipes';

const ingredientSchema = z.object({
  inventoryItemId: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(40),
  notes: z.string().trim().max(500).optional().nullable(),
});

const recipeCreateSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  menuItemId: z.string().trim().min(1),
  ingredients: z.array(ingredientSchema).max(50).optional().default([]),
});

function hasDuplicateInventoryItems(ingredients) {
  const ids = new Set();
  for (const ingredient of ingredients) {
    if (ids.has(ingredient.inventoryItemId)) return true;
    ids.add(ingredient.inventoryItemId);
  }
  return false;
}

async function getTenantRecipe(menuItemId, restaurantId) {
  return prisma.menuItem.findFirst({
    where: { id: menuItemId, restaurantId },
    include: {
      category: true,
      ingredients: {
        where: { restaurantId },
        include: { inventoryItem: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

async function getActiveInventoryItemsById(ids, restaurantId) {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return [];

  return prisma.inventoryItem.findMany({
    where: {
      id: { in: uniqueIds },
      restaurantId,
      isActive: true,
    },
  });
}

function toIngredientData(ingredient, menuItemId, restaurantId) {
  return {
    menuItemId,
    inventoryItemId: ingredient.inventoryItemId,
    quantity: ingredient.quantity,
    unit: normalizeRecipeIngredientUnit(ingredient.unit),
    notes: normalizeOptionalText(ingredient.notes),
    restaurantId,
  };
}

function isPrismaUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);

    const [menuItems, inventoryItems] = await Promise.all([
      prisma.menuItem.findMany({
        where: { restaurantId: staff.restaurantId },
        orderBy: [{ name: 'asc' }],
        include: {
          category: true,
          ingredients: {
            where: { restaurantId: staff.restaurantId },
            include: { inventoryItem: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.inventoryItem.findMany({
        where: { restaurantId: staff.restaurantId, isActive: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return success({
      recipes: menuItems.map(normalizeMenuItemRecipe),
      inventoryItems: inventoryItems.map(normalizeInventoryItem),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = recipeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid recipe payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const ingredients = parsed.data.ingredients || [];

    if (ingredients.some((ingredient) => !validateRecipeIngredientQuantity(ingredient.quantity))) {
      return failure('Recipe ingredient quantity must be positive', 400);
    }

    if (hasDuplicateInventoryItems(ingredients)) {
      return failure('Each inventory item can only appear once in a recipe', 400);
    }

    const menuItem = await getTenantRecipe(parsed.data.menuItemId, staff.restaurantId);
    if (!menuItem) return failure('Menu item not found', 404);

    if (menuItem.ingredients.length) {
      return failure('Recipe already has ingredient mappings', 409);
    }

    const inventoryItems = await getActiveInventoryItemsById(
      ingredients.map((ingredient) => ingredient.inventoryItemId),
      staff.restaurantId,
    );
    if (inventoryItems.length !== new Set(ingredients.map((ingredient) => ingredient.inventoryItemId)).size) {
      return failure('Inventory item is not available', 404);
    }

    try {
      if (ingredients.length) {
        await prisma.menuItemIngredient.createMany({
          data: ingredients.map((ingredient) => toIngredientData(ingredient, menuItem.id, staff.restaurantId)),
        });
      }
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return failure('This inventory item is already mapped to the selected menu item', 409);
      }
      throw error;
    }

    const recipe = await getTenantRecipe(menuItem.id, staff.restaurantId);
    return success({ recipe: normalizeMenuItemRecipe(recipe) });
  } catch (error) {
    return handleApiError(error);
  }
}
