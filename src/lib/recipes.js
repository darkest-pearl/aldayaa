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

export function getMenuItemIngredientCount(menuItem = {}) {
  const count = menuItem.ingredientCount ?? menuItem.ingredients?.length ?? 0;
  return Math.max(0, Math.trunc(toNumber(count)));
}

export function hasRecipeMapping(menuItem = {}) {
  return getMenuItemIngredientCount(menuItem) > 0;
}

export function getRecipeMappingCoverage(menuItems = []) {
  const items = Array.isArray(menuItems) ? menuItems : [];
  const totalMenuItems = items.length;
  const mappedMenuItems = items.filter(hasRecipeMapping).length;
  const unmappedMenuItems = Math.max(totalMenuItems - mappedMenuItems, 0);
  const totalIngredientMappings = items.reduce((sum, item) => sum + getMenuItemIngredientCount(item), 0);

  return {
    totalMenuItems,
    mappedMenuItems,
    unmappedMenuItems,
    totalIngredientMappings,
  };
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
