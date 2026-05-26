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

export function normalizeRecipeConsumptionLine(line = {}) {
  const recipeQuantity = toNumber(line.recipeQuantity);
  const orderQuantity = toNumber(line.orderQuantity);
  const totalRequiredQuantity = toNumber(line.totalRequiredQuantity, recipeQuantity * orderQuantity);
  const missingMapping = Boolean(line.missingMapping);
  const inventoryItem = line.inventoryItem ? normalizeInventoryItem(line.inventoryItem) : null;

  return {
    menuItemId: line.menuItemId || null,
    menuItemName: line.menuItemName || 'Menu item',
    orderItemId: line.orderItemId || null,
    inventoryItemId: inventoryItem?.id || line.inventoryItemId || null,
    inventoryItemName: inventoryItem?.name || line.inventoryItemName || null,
    recipeQuantity,
    orderQuantity,
    totalRequiredQuantity,
    unit: normalizeRecipeIngredientUnit(line.unit || inventoryItem?.unit || ''),
    currentStock: inventoryItem?.currentStock ??
      (line.currentStock === null || line.currentStock === undefined ? null : toNumber(line.currentStock)),
    stockStatus: inventoryItem?.stockStatus || line.stockStatus || null,
    stockStatusLabel: inventoryItem?.stockStatusLabel || line.stockStatusLabel || null,
    missingMapping,
  };
}

export function aggregateRecipeConsumption(orderItems = []) {
  const items = Array.isArray(orderItems) ? orderItems : [];
  const linesByKey = new Map();
  const missingMappings = [];

  for (const orderItem of items) {
    const menuItemId = orderItem.menuItemId || orderItem.itemId || orderItem.menuItem?.id || null;
    const menuItemName = orderItem.menuItemName || orderItem.name || orderItem.menuItem?.name || 'Menu item';
    const orderQuantity = toNumber(orderItem.quantity);
    const recipeIngredients = orderItem.recipeIngredients || orderItem.ingredients || orderItem.menuItem?.ingredients || [];

    if (!recipeIngredients.length) {
      const key = `missing:${menuItemId || orderItem.id || menuItemName}`;
      const existing = linesByKey.get(key);
      if (existing) {
        linesByKey.set(key, {
          ...existing,
          orderQuantity: existing.orderQuantity + orderQuantity,
        });
      } else {
        const line = normalizeRecipeConsumptionLine({
          menuItemId,
          menuItemName,
          orderItemId: orderItem.id,
          orderQuantity,
          missingMapping: true,
        });
        linesByKey.set(key, line);
      }

      missingMappings.push({
        menuItemId,
        menuItemName,
        orderItemId: orderItem.id,
        orderQuantity,
        missingMapping: true,
      });
      continue;
    }

    for (const ingredient of recipeIngredients) {
      const inventoryItem = ingredient.inventoryItem || null;
      const recipeQuantity = toNumber(ingredient.quantity);
      const unit = normalizeRecipeIngredientUnit(ingredient.unit || inventoryItem?.unit || '');
      const inventoryItemId = ingredient.inventoryItemId || inventoryItem?.id || null;
      const key = `${menuItemId || menuItemName}:${inventoryItemId || ingredient.id}:${unit}`;
      const existing = linesByKey.get(key);
      const nextRequired = recipeQuantity * orderQuantity;

      if (existing) {
        linesByKey.set(key, {
          ...existing,
          orderQuantity: existing.orderQuantity + orderQuantity,
          totalRequiredQuantity: existing.totalRequiredQuantity + nextRequired,
        });
        continue;
      }

      linesByKey.set(
        key,
        normalizeRecipeConsumptionLine({
          menuItemId,
          menuItemName,
          orderItemId: orderItem.id,
          inventoryItemId,
          inventoryItem,
          inventoryItemName: inventoryItem?.name || ingredient.inventoryItemName || null,
          recipeQuantity,
          orderQuantity,
          totalRequiredQuantity: nextRequired,
          unit,
          missingMapping: false,
        }),
      );
    }
  }

  const lines = Array.from(linesByKey.values());

  return {
    lines,
    missingMappings,
    hasMissingMappings: missingMappings.length > 0,
    totalLines: lines.length,
  };
}

export function calculateRecipeConsumptionForOrder(order = {}) {
  const consumption = aggregateRecipeConsumption(order.items || []);

  return {
    orderId: order.id || null,
    reference: order.reference || null,
    lines: consumption.lines,
    missingMappings: consumption.missingMappings,
    hasMissingMappings: consumption.hasMissingMappings,
    totalLines: consumption.totalLines,
  };
}
