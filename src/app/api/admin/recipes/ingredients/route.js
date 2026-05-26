export const dynamic = "force-dynamic";
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/auth';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { FEATURE_KEYS } from '../../../../../lib/features';
import { requireFeatureEnabled } from '../../../../../lib/module-access';
import { prisma } from '../../../../../lib/prisma';
import { getRestaurantProfile } from '../../../../../lib/restaurant-profile';
import {
  normalizeMenuItemIngredient,
  normalizeRecipeIngredientUnit,
  validateRecipeIngredientQuantity,
} from '../../../../../lib/recipes';

const ingredientSchema = z.object({
  menuItemId: z.string().trim().min(1),
  inventoryItemId: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(40),
  notes: z.string().trim().max(500).optional().nullable(),
});

function cleanOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function requireRecipeFeature(request, roles) {
  await requireAdmin(request, roles);
  const profile = await getRestaurantProfile();
  requireFeatureEnabled(profile, FEATURE_KEYS.RECIPE_CONSUMPTION);
}

export async function GET(request) {
  try {
    await requireRecipeFeature(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const menuItemId = request.nextUrl?.searchParams?.get('menuItemId')?.trim();

    if (!menuItemId) {
      return failure('menuItemId is required', 400);
    }

    const ingredients = await prisma.menuItemIngredient.findMany({
      where: { menuItemId },
      include: { inventoryItem: true },
      orderBy: { createdAt: 'asc' },
    });

    return success({ ingredients: ingredients.map(normalizeMenuItemIngredient) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    await requireRecipeFeature(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = ingredientSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid recipe ingredient payload', 400, { details: parsed.error.flatten() });
    }

    if (!validateRecipeIngredientQuantity(parsed.data.quantity)) {
      return failure('Recipe ingredient quantity must be positive', 400);
    }

    const [menuItem, inventoryItem, existing] = await Promise.all([
      prisma.menuItem.findUnique({ where: { id: parsed.data.menuItemId } }),
      prisma.inventoryItem.findFirst({ where: { id: parsed.data.inventoryItemId, isActive: true } }),
      prisma.menuItemIngredient.findUnique({
        where: {
          menuItemId_inventoryItemId: {
            menuItemId: parsed.data.menuItemId,
            inventoryItemId: parsed.data.inventoryItemId,
          },
        },
      }),
    ]);

    if (!menuItem) return failure('Menu item not found', 404);
    if (!inventoryItem) return failure('Inventory item is not available', 404);
    if (existing) return failure('This inventory item is already mapped to the selected menu item', 409);

    const ingredient = await prisma.menuItemIngredient.create({
      data: {
        menuItemId: parsed.data.menuItemId,
        inventoryItemId: parsed.data.inventoryItemId,
        quantity: parsed.data.quantity,
        unit: normalizeRecipeIngredientUnit(parsed.data.unit),
        notes: cleanOptionalString(parsed.data.notes),
      },
      include: { inventoryItem: true },
    });

    return success({ ingredient: normalizeMenuItemIngredient(ingredient) });
  } catch (error) {
    return handleApiError(error);
  }
}
