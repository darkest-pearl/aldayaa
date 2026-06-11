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

export function getRecipeIngredientEstimatedCost(ingredient = {}) {
  const inventoryItem = ingredient.inventoryItem || {};
  const costPerUnit = inventoryItem.costPerUnit;
  if (costPerUnit === null || costPerUnit === undefined) return null;
  return toNumber(ingredient.quantity) * toNumber(costPerUnit);
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
  const estimatedCost = getRecipeIngredientEstimatedCost(ingredient);

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
    estimatedCost,
    notes: ingredient.notes || null,
    createdAt: ingredient.createdAt,
    updatedAt: ingredient.updatedAt,
  };
}

export function getMenuItemRecipeEstimatedCost(menuItem = {}) {
  const ingredients = Array.isArray(menuItem.ingredients) ? menuItem.ingredients : [];
  return ingredients.reduce((total, ingredient) => total + toNumber(getRecipeIngredientEstimatedCost(ingredient)), 0);
}

export function getRecipeLowStockIngredientCount(menuItem = {}) {
  const ingredients = Array.isArray(menuItem.ingredients) ? menuItem.ingredients : [];
  return ingredients.filter((ingredient) => {
    const item = ingredient.inventoryItem || {};
    return item.stockStatus === 'LOW_STOCK' || item.stockStatus === 'OUT_OF_STOCK' || item.isLowStock;
  }).length;
}

export function normalizeMenuItemRecipe(menuItem = {}) {
  const ingredients = (menuItem.ingredients || []).map(normalizeMenuItemIngredient);
  const ingredientCount = getMenuItemIngredientCount({ ...menuItem, ingredients });
  const estimatedCost = ingredients.reduce((sum, ingredient) => sum + toNumber(ingredient.estimatedCost), 0);
  const missingCostCount = ingredients.filter((ingredient) => ingredient.estimatedCost === null).length;

  return {
    id: menuItem.id,
    menuItemId: menuItem.id,
    name: menuItem.name || '',
    description: menuItem.description || '',
    price: toNumber(menuItem.price),
    categoryId: menuItem.categoryId || null,
    categoryName: menuItem.category?.name || null,
    ingredientCount,
    hasRecipeMapping: hasRecipeMapping({ ...menuItem, ingredientCount }),
    estimatedCost,
    missingCostCount,
    lowStockIngredientCount: ingredients.filter((ingredient) =>
      ingredient.inventoryItemStockStatus === 'LOW_STOCK' ||
      ingredient.inventoryItemStockStatus === 'OUT_OF_STOCK'
    ).length,
    ingredients,
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
  const lines = [];
  const missingMappings = [];

  for (const orderItem of items) {
    const menuItemId = orderItem.menuItemId || orderItem.itemId || orderItem.menuItem?.id || null;
    const menuItemName = orderItem.menuItemName || orderItem.name || orderItem.menuItem?.name || 'Menu item';
    const orderQuantity = toNumber(orderItem.quantity);
    const recipeIngredients = orderItem.recipeIngredients || orderItem.ingredients || orderItem.menuItem?.ingredients || [];

    if (!recipeIngredients.length) {
      const line = normalizeRecipeConsumptionLine({
        menuItemId,
        menuItemName,
        orderItemId: orderItem.id,
        orderQuantity,
        missingMapping: true,
      });
      lines.push(line);
      missingMappings.push(line);
      continue;
    }

    for (const ingredient of recipeIngredients) {
      const inventoryItem = ingredient.inventoryItem || null;
      const recipeQuantity = toNumber(ingredient.quantity);
      const unit = normalizeRecipeIngredientUnit(ingredient.unit || inventoryItem?.unit || '');
      const inventoryItemId = ingredient.inventoryItemId || inventoryItem?.id || null;
      const nextRequired = recipeQuantity * orderQuantity;

      lines.push(
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
