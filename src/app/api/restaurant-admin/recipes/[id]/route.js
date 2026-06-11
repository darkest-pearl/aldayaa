export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';
import {
  normalizeMenuItemRecipe,
  normalizeRecipeIngredientUnit,
  validateRecipeIngredientQuantity,
} from '../../../../../lib/recipes';

const ingredientSchema = z.object({
  inventoryItemId: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(40),
  notes: z.string().trim().max(500).optional().nullable(),
});

const recipeUpdateSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  ingredients: z.array(ingredientSchema).max(50),
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

async function countAvailableInventoryItems(ids, restaurantId) {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return 0;

  return prisma.inventoryItem.count({
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

export async function GET(request, { params }) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const recipe = await getTenantRecipe(params.id, staff.restaurantId);
    if (!recipe) return failure('Recipe menu item not found', 404);

    return success({ recipe: normalizeMenuItemRecipe(recipe), staffRole: staff.role });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = recipeUpdateSchema.safeParse(body);
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

    const menuItem = await prisma.menuItem.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true },
    });
    if (!menuItem) return failure('Recipe menu item not found', 404);

    const availableInventoryCount = await countAvailableInventoryItems(
      ingredients.map((ingredient) => ingredient.inventoryItemId),
      staff.restaurantId,
    );
    if (availableInventoryCount !== new Set(ingredients.map((ingredient) => ingredient.inventoryItemId)).size) {
      return failure('Inventory item is not available', 404);
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.menuItemIngredient.deleteMany({
          where: { menuItemId: params.id, restaurantId: staff.restaurantId },
        });

        if (ingredients.length) {
          await tx.menuItemIngredient.createMany({
            data: ingredients.map((ingredient) => toIngredientData(ingredient, params.id, staff.restaurantId)),
          });
        }
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return failure('This inventory item is already mapped to the selected menu item', 409);
      }
      throw error;
    }

    const recipe = await getTenantRecipe(params.id, staff.restaurantId);
    return success({ recipe: normalizeMenuItemRecipe(recipe) });
  } catch (error) {
    return handleApiError(error);
  }
}
