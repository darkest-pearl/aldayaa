export const dynamic = "force-dynamic";
import { z } from 'zod';
import { requireAdmin } from '../../../../../../lib/auth';
import { failure, handleApiError, success } from '../../../../../../lib/api-response';
import { FEATURE_KEYS } from '../../../../../../lib/features';
import { normalizeInventoryItem, normalizeInventoryUnit } from '../../../../../../lib/inventory';
import { requireFeatureEnabled } from '../../../../../../lib/module-access';
import { prisma } from '../../../../../../lib/prisma';
import { getRestaurantProfile } from '../../../../../../lib/restaurant-profile';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  sku: z.string().trim().max(80).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  unit: z.string().trim().min(1).max(40).optional(),
  currentStock: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).optional().nullable(),
  costPerUnit: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

function cleanOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function requireInventoryFeature(request) {
  await requireAdmin(request, ['ADMIN', 'MANAGER']);
  const profile = await getRestaurantProfile({ fallbackOnError: false });
  requireFeatureEnabled(profile, FEATURE_KEYS.INVENTORY);
}

export async function PUT(request, { params }) {
  try {
    await requireInventoryFeature(request);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid inventory item payload', 400, { details: parsed.error.flatten() });
    }

    const existing = await prisma.inventoryItem.findUnique({ where: { id: params.id } });
    if (!existing) return failure('Inventory item not found', 404);

    const item = await prisma.inventoryItem.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.sku !== undefined ? { sku: cleanOptionalString(parsed.data.sku) } : {}),
        ...(parsed.data.category !== undefined ? { category: cleanOptionalString(parsed.data.category) } : {}),
        ...(parsed.data.unit !== undefined ? { unit: normalizeInventoryUnit(parsed.data.unit) } : {}),
        ...(parsed.data.currentStock !== undefined ? { currentStock: parsed.data.currentStock } : {}),
        ...(parsed.data.reorderLevel !== undefined ? { reorderLevel: parsed.data.reorderLevel ?? null } : {}),
        ...(parsed.data.costPerUnit !== undefined ? { costPerUnit: parsed.data.costPerUnit ?? null } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.notes !== undefined ? { notes: cleanOptionalString(parsed.data.notes) } : {}),
      },
    });

    return success({ item: normalizeInventoryItem(item) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireInventoryFeature(request);
    const existing = await prisma.inventoryItem.findUnique({ where: { id: params.id } });
    if (!existing) return failure('Inventory item not found', 404);

    const item = await prisma.inventoryItem.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return success({ item: normalizeInventoryItem(item) });
  } catch (error) {
    return handleApiError(error);
  }
}
