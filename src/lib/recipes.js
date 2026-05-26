import { normalizeInventoryItem, normalizeInventoryUnit } from './inventory';

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function validateRecipeIngredientQuantity(quantity) {
  return toNumber(quantity) > 0;
}

export function normalizeRecipeIngredientUnit(unit) {
  return normalizeInventoryUnit(unit);
}

export function normalizeMenuItemIngredient(ingredient = {}) {
  const inventoryItem = ingredient.inventoryItem ? normalizeInventoryItem(ingredient.inventoryItem) : null;

  return {
    id: ingredient.id,
    menuItemId: ingredient.menuItemId,
    inventoryItemId: ingredient.inventoryItemId,
    inventoryItem,
    inventoryItemName: inventoryItem?.name || ingredient.inventoryItem?.name || null,
    inventoryItemSku: inventoryItem?.sku || ingredient.inventoryItem?.sku || null,
    inventoryItemStock: inventoryItem?.currentStock ?? null,
    inventoryItemUnit: inventoryItem?.unit || null,
    inventoryItemStockStatus: inventoryItem?.stockStatus || null,
    inventoryItemStockStatusLabel: inventoryItem?.stockStatusLabel || null,
    quantity: toNumber(ingredient.quantity),
    unit: normalizeRecipeIngredientUnit(ingredient.unit),
    notes: ingredient.notes || null,
    createdAt: ingredient.createdAt,
    updatedAt: ingredient.updatedAt,
  };
}
