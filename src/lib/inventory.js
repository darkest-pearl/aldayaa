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

export const INVENTORY_STOCK_STATUSES = Object.freeze({
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  OK: 'OK',
});

export const INVENTORY_STOCK_STATUS_LABELS = Object.freeze({
  [INVENTORY_STOCK_STATUSES.OUT_OF_STOCK]: 'Out of stock',
  [INVENTORY_STOCK_STATUSES.LOW_STOCK]: 'Low stock',
  [INVENTORY_STOCK_STATUSES.OK]: 'OK',
});

export const INVENTORY_UNIT_OPTIONS = Object.freeze([
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'liter', label: 'liter' },
  { value: 'ml', label: 'ml' },
  { value: 'piece', label: 'piece' },
  { value: 'pack', label: 'pack' },
  { value: 'carton', label: 'carton' },
  { value: 'box', label: 'box' },
  { value: 'bottle', label: 'bottle' },
  { value: 'bag', label: 'bag' },
]);

const inventoryMovementTypeValues = Object.freeze(Object.values(INVENTORY_MOVEMENT_TYPES));
const inventoryUnitAliases = Object.freeze({
  kilogram: 'kg',
  kilograms: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  gram: 'g',
  grams: 'g',
  litre: 'liter',
  litres: 'liter',
  liters: 'liter',
  l: 'liter',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  pcs: 'piece',
  pc: 'piece',
  pieces: 'piece',
  packs: 'pack',
  cartons: 'carton',
  boxes: 'box',
  bottles: 'bottle',
  bags: 'bag',
});
const inventoryUnitValues = Object.freeze(INVENTORY_UNIT_OPTIONS.map((unit) => unit.value));

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

export function getInventoryStockStatus(item = {}) {
  const currentStock = toNumber(item.currentStock);
  const reorderLevel = item.reorderLevel === null || item.reorderLevel === undefined
    ? null
    : toNumber(item.reorderLevel);

  if (currentStock <= 0) {
    return INVENTORY_STOCK_STATUSES.OUT_OF_STOCK;
  }

  if (reorderLevel !== null && currentStock <= reorderLevel) {
    return INVENTORY_STOCK_STATUSES.LOW_STOCK;
  }

  return INVENTORY_STOCK_STATUSES.OK;
}

export function getInventoryStockStatusLabel(status) {
  return INVENTORY_STOCK_STATUS_LABELS[status] || status || 'Stock status';
}

export function normalizeInventoryUnit(unit) {
  const trimmed = typeof unit === 'string' ? unit.trim().replace(/\s+/g, ' ') : '';
  if (!trimmed) return '';

  const normalized = trimmed.toLowerCase();
  if (inventoryUnitValues.includes(normalized)) return normalized;
  return inventoryUnitAliases[normalized] || trimmed;
}

export function getInventoryUnitLabel(unit) {
  const normalized = normalizeInventoryUnit(unit);
  const option = INVENTORY_UNIT_OPTIONS.find((item) => item.value === normalized);
  return option?.label || normalized;
}

export function getInventoryUnitOptions() {
  return INVENTORY_UNIT_OPTIONS.map((unit) => ({ ...unit }));
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
  const stockStatus = getInventoryStockStatus({ currentStock, reorderLevel });

  return {
    id: item.id,
    name: item.name || '',
    sku: item.sku || null,
    category: item.category || null,
    unit: normalizeInventoryUnit(item.unit),
    currentStock,
    reorderLevel,
    costPerUnit: item.costPerUnit === null || item.costPerUnit === undefined ? null : toNumber(item.costPerUnit),
    isActive: item.isActive !== false,
    notes: item.notes || null,
    isLowStock: stockStatus === INVENTORY_STOCK_STATUSES.LOW_STOCK,
    stockStatus,
    stockStatusLabel: getInventoryStockStatusLabel(stockStatus),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function normalizeInventoryMovement(movement = {}) {
  return {
    id: movement.id,
    itemId: movement.itemId,
    itemName: movement.item?.name || null,
    itemUnit: movement.item?.unit ? normalizeInventoryUnit(movement.item.unit) : null,
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
