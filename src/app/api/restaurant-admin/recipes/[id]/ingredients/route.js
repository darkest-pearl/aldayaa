export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../../lib/api-response';
import { prisma } from '../../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../../lib/restaurant-staff-access';
import {
  normalizeMenuItemIngredient,
  normalizeRecipeIngredientUnit,
  validateRecipeIngredientQuantity,
} from '../../../../../../lib/recipes';

const ingredientCreateSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  inventoryItemId: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(40),
  notes: z.string().trim().max(500).optional().nullable(),
});

const ingredientUpdateSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  ingredientId: z.string().trim().min(1),
  inventoryItemId: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const ingredientDeleteSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  ingredientId: z.string().trim().min(1),
});

function hasUpdateFields(data) {
  return (
    data.inventoryItemId !== undefined ||
    data.quantity !== undefined ||
    data.unit !== undefined ||
    data.notes !== undefined
  );
}

async function findTenantMenuItem(menuItemId, restaurantId) {
  return prisma.menuItem.findFirst({
    where: { id: menuItemId, restaurantId },
    select: { id: true },
  });
}

async function findTenantInventoryItem(inventoryItemId, restaurantId) {
  return prisma.inventoryItem.findFirst({
    where: { id: inventoryItemId, restaurantId, isActive: true },
    select: { id: true },
  });
}

async function findTenantIngredient(ingredientId, menuItemId, restaurantId) {
  return prisma.menuItemIngredient.findFirst({
    where: { id: ingredientId, menuItemId, restaurantId },
    include: { inventoryItem: true },
  });
}

function toIngredientData(data) {
  return {
    inventoryItemId: data.inventoryItemId,
    quantity: data.quantity,
    unit: normalizeRecipeIngredientUnit(data.unit),
    notes: normalizeOptionalText(data.notes),
  };
}

function isPrismaUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

export async function GET(request, { params }) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const menuItem = await findTenantMenuItem(params.id, staff.restaurantId);
    if (!menuItem) return failure('Menu item not found', 404);

    const ingredients = await prisma.menuItemIngredient.findMany({
      where: { menuItemId: params.id, restaurantId: staff.restaurantId },
      include: { inventoryItem: true },
      orderBy: { createdAt: 'asc' },
    });

    return success({ ingredients: ingredients.map(normalizeMenuItemIngredient), staffRole: staff.role });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const parsed = ingredientCreateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid recipe ingredient payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    if (!validateRecipeIngredientQuantity(parsed.data.quantity)) {
      return failure('Recipe ingredient quantity must be positive', 400);
    }

    const [menuItem, inventoryItem, duplicate] = await Promise.all([
      findTenantMenuItem(params.id, staff.restaurantId),
      findTenantInventoryItem(parsed.data.inventoryItemId, staff.restaurantId),
      prisma.menuItemIngredient.findFirst({
        where: {
          menuItemId: params.id,
          inventoryItemId: parsed.data.inventoryItemId,
          restaurantId: staff.restaurantId,
        },
        select: { id: true },
      }),
    ]);

    if (!menuItem) return failure('Menu item not found', 404);
    if (!inventoryItem) return failure('Inventory item is not available', 404);
    if (duplicate) return failure('This inventory item is already mapped to the selected menu item', 409);

    let ingredient;
    try {
      ingredient = await prisma.menuItemIngredient.create({
        data: {
          ...toIngredientData(parsed.data),
          menuItemId: params.id,
          restaurantId: staff.restaurantId,
        },
        include: { inventoryItem: true },
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return failure('This inventory item is already mapped to the selected menu item', 409);
      }
      throw error;
    }

    return success({ ingredient: normalizeMenuItemIngredient(ingredient) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = ingredientUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid recipe ingredient payload', 400, { details: parsed.error.flatten() });
    }

    if (!hasUpdateFields(parsed.data)) {
      return failure('No recipe ingredient changes provided', 400);
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existing = await findTenantIngredient(parsed.data.ingredientId, params.id, staff.restaurantId);
    if (!existing) return failure('Recipe ingredient mapping not found', 404);

    if (parsed.data.quantity !== undefined && !validateRecipeIngredientQuantity(parsed.data.quantity)) {
      return failure('Recipe ingredient quantity must be positive', 400);
    }

    const nextInventoryItemId = parsed.data.inventoryItemId || existing.inventoryItemId;
    if (parsed.data.inventoryItemId !== undefined) {
      const inventoryItem = await findTenantInventoryItem(parsed.data.inventoryItemId, staff.restaurantId);
      if (!inventoryItem) return failure('Inventory item is not available', 404);

      const duplicate = await prisma.menuItemIngredient.findFirst({
        where: {
          menuItemId: params.id,
          inventoryItemId: nextInventoryItemId,
          restaurantId: staff.restaurantId,
          NOT: { id: parsed.data.ingredientId },
        },
        select: { id: true },
      });
      if (duplicate) return failure('This inventory item is already mapped to the selected menu item', 409);
    }

    const updateResult = await prisma.menuItemIngredient.updateMany({
      where: {
        id: parsed.data.ingredientId,
        menuItemId: params.id,
        restaurantId: staff.restaurantId,
      },
      data: {
        ...(parsed.data.inventoryItemId !== undefined ? { inventoryItemId: nextInventoryItemId } : {}),
        ...(parsed.data.quantity !== undefined ? { quantity: parsed.data.quantity } : {}),
        ...(parsed.data.unit !== undefined ? { unit: normalizeRecipeIngredientUnit(parsed.data.unit) } : {}),
        ...(parsed.data.notes !== undefined ? { notes: normalizeOptionalText(parsed.data.notes) } : {}),
      },
    });

    if (updateResult.count !== 1) return failure('Recipe ingredient mapping not found', 404);

    const ingredient = await findTenantIngredient(parsed.data.ingredientId, params.id, staff.restaurantId);
    return success({ ingredient: normalizeMenuItemIngredient(ingredient) });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return failure('This inventory item is already mapped to the selected menu item', 409);
    }
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const body = await request.json();
    const parsed = ingredientDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid recipe ingredient payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existing = await findTenantIngredient(parsed.data.ingredientId, params.id, staff.restaurantId);
    if (!existing) return failure('Recipe ingredient mapping not found', 404);

    const deleted = await prisma.menuItemIngredient.deleteMany({
      where: {
        id: parsed.data.ingredientId,
        menuItemId: params.id,
        restaurantId: staff.restaurantId,
      },
    });
    if (deleted.count !== 1) return failure('Recipe ingredient mapping not found', 404);

    return success({ ingredient: normalizeMenuItemIngredient(existing) });
  } catch (error) {
    return handleApiError(error);
  }
}
