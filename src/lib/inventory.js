export const INVENTORY_MOVEMENT_TYPES = Object.freeze({
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  ADJUSTMENT: 'ADJUSTMENT',
  WASTE: 'WASTE',
  COUNT_CORRECTION: 'COUNT_CORRECTION',
});

export const INVENTORY_MOVEMENT_TYPE_LABELS = Object.freeze({
  [INVENTORY_MOVEMENT_TYPES.STOCK_IN]: 'Stock in',
  [INVENTORY_MOVEMENT_TYPES.STOCK_OUT]: 'Stock out',
  [INVENTORY_MOVEMENT_TYPES.ADJUSTMENT]: 'Adjustment',
  [INVENTORY_MOVEMENT_TYPES.WASTE]: 'Waste',
  [INVENTORY_MOVEMENT_TYPES.COUNT_CORRECTION]: 'Count correction',
});

const inventoryMovementTypeValues = Object.freeze(Object.values(INVENTORY_MOVEMENT_TYPES));

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function isValidInventoryMovementType(type) {
  return inventoryMovementTypeValues.includes(type);
}

export function getInventoryMovementTypeLabel(type) {
  return INVENTORY_MOVEMENT_TYPE_LABELS[type] || type || 'Movement';
}

export function calculateStockAfterMovement(currentStock, type, quantity) {
  const stock = toNumber(currentStock);
  const amount = toNumber(quantity);

  if (type === INVENTORY_MOVEMENT_TYPES.STOCK_IN) {
    return stock + amount;
  }

  if (type === INVENTORY_MOVEMENT_TYPES.STOCK_OUT || type === INVENTORY_MOVEMENT_TYPES.WASTE) {
    return stock - amount;
  }

  if (type === INVENTORY_MOVEMENT_TYPES.ADJUSTMENT || type === INVENTORY_MOVEMENT_TYPES.COUNT_CORRECTION) {
    return amount;
  }

  return stock;
}

export function normalizeInventoryItem(item = {}) {
  const currentStock = toNumber(item.currentStock);
  const reorderLevel = item.reorderLevel === null || item.reorderLevel === undefined
    ? null
    : toNumber(item.reorderLevel);

  return {
    id: item.id,
    name: item.name || '',
    sku: item.sku || null,
    category: item.category || null,
    unit: item.unit || '',
    currentStock,
    reorderLevel,
    costPerUnit: item.costPerUnit === null || item.costPerUnit === undefined ? null : toNumber(item.costPerUnit),
    isActive: item.isActive !== false,
    notes: item.notes || null,
    isLowStock: reorderLevel !== null && currentStock <= reorderLevel,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function normalizeInventoryMovement(movement = {}) {
  return {
    id: movement.id,
    itemId: movement.itemId,
    itemName: movement.item?.name || null,
    itemUnit: movement.item?.unit || null,
    type: movement.type,
    typeLabel: getInventoryMovementTypeLabel(movement.type),
    quantity: toNumber(movement.quantity),
    reason: movement.reason || null,
    source: movement.source || null,
    createdByAdminId: movement.createdByAdminId || null,
    createdByAdminEmail: movement.createdByAdminEmail || null,
    createdAt: movement.createdAt,
  };
}
