export const dynamic = "force-dynamic";
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/auth';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { FEATURE_KEYS } from '../../../../../lib/features';
import { normalizeInventoryItem, normalizeInventoryUnit } from '../../../../../lib/inventory';
import { requireFeatureEnabled } from '../../../../../lib/module-access';
import { prisma } from '../../../../../lib/prisma';
import { getRestaurantProfile } from '../../../../../lib/restaurant-profile';

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(80).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  unit: z.string().trim().min(1).max(40),
  currentStock: z.coerce.number().min(0).default(0),
  reorderLevel: z.coerce.number().min(0).optional().nullable(),
  costPerUnit: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

function cleanOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function requireInventoryFeature(request, roles) {
  await requireAdmin(request, roles);
  const profile = await getRestaurantProfile({ fallbackOnError: false });
  requireFeatureEnabled(profile, FEATURE_KEYS.INVENTORY);
}

export async function GET(request) {
  try {
    await requireInventoryFeature(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const items = await prisma.inventoryItem.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    return success({ items: items.map(normalizeInventoryItem) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    await requireInventoryFeature(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = itemSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid inventory item payload', 400, { details: parsed.error.flatten() });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name: parsed.data.name.trim(),
        sku: cleanOptionalString(parsed.data.sku),
        category: cleanOptionalString(parsed.data.category),
        unit: normalizeInventoryUnit(parsed.data.unit),
        currentStock: parsed.data.currentStock,
        reorderLevel: parsed.data.reorderLevel ?? null,
        costPerUnit: parsed.data.costPerUnit ?? null,
        isActive: parsed.data.isActive ?? true,
        notes: cleanOptionalString(parsed.data.notes),
      },
    });

    return success({ item: normalizeInventoryItem(item) });
  } catch (error) {
    return handleApiError(error);
  }
}
