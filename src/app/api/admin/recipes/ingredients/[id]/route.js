export const dynamic = "force-dynamic";
import { z } from 'zod';
import { requireAdmin } from '../../../../../../lib/auth';
import { failure, handleApiError, success } from '../../../../../../lib/api-response';
import { FEATURE_KEYS } from '../../../../../../lib/features';
import { requireFeatureEnabled } from '../../../../../../lib/module-access';
import { prisma } from '../../../../../../lib/prisma';
import { getRestaurantProfile } from '../../../../../../lib/restaurant-profile';
import {
  normalizeMenuItemIngredient,
  normalizeRecipeIngredientUnit,
  validateRecipeIngredientQuantity,
} from '../../../../../../lib/recipes';

const updateSchema = z.object({
  inventoryItemId: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

function cleanOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function requireRecipeFeature(request, roles) {
  await requireAdmin(request, roles);
  const profile = await getRestaurantProfile({ fallbackOnError: false });
  requireFeatureEnabled(profile, FEATURE_KEYS.RECIPE_CONSUMPTION);
}

export async function PUT(request, { params }) {
  try {
    await requireRecipeFeature(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid recipe ingredient payload', 400, { details: parsed.error.flatten() });
    }

    const existing = await prisma.menuItemIngredient.findUnique({ where: { id: params.id } });
    if (!existing) return failure('Recipe ingredient mapping not found', 404);

    if (parsed.data.quantity !== undefined && !validateRecipeIngredientQuantity(parsed.data.quantity)) {
      return failure('Recipe ingredient quantity must be positive', 400);
    }

    if (parsed.data.inventoryItemId !== undefined && parsed.data.inventoryItemId !== existing.inventoryItemId) {
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: { id: parsed.data.inventoryItemId, isActive: true },
      });
      if (!inventoryItem) return failure('Inventory item is not available', 404);

      const duplicate = await prisma.menuItemIngredient.findFirst({
        where: {
          menuItemId: existing.menuItemId,
          inventoryItemId: parsed.data.inventoryItemId,
          NOT: { id: params.id },
        },
      });
      if (duplicate) return failure('This inventory item is already mapped to the selected menu item', 409);
    }

    const ingredient = await prisma.menuItemIngredient.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.inventoryItemId !== undefined ? { inventoryItemId: parsed.data.inventoryItemId } : {}),
        ...(parsed.data.quantity !== undefined ? { quantity: parsed.data.quantity } : {}),
        ...(parsed.data.unit !== undefined ? { unit: normalizeRecipeIngredientUnit(parsed.data.unit) } : {}),
        ...(parsed.data.notes !== undefined ? { notes: cleanOptionalString(parsed.data.notes) } : {}),
      },
      include: { inventoryItem: true },
    });

    return success({ ingredient: normalizeMenuItemIngredient(ingredient) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireRecipeFeature(request, ['ADMIN', 'MANAGER']);
    const existing = await prisma.menuItemIngredient.findUnique({ where: { id: params.id } });
    if (!existing) return failure('Recipe ingredient mapping not found', 404);

    const ingredient = await prisma.menuItemIngredient.delete({
      where: { id: params.id },
      include: { inventoryItem: true },
    });

    return success({ ingredient: normalizeMenuItemIngredient(ingredient) });
  } catch (error) {
    return handleApiError(error);
  }
}
