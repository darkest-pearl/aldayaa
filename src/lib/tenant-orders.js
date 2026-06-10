export const TENANT_ORDER_INCLUDE = Object.freeze({
  items: {
    orderBy: { id: 'asc' },
  },
  table: {
    select: {
      id: true,
      label: true,
      slug: true,
      zone: true,
    },
  },
});

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : value || null;
}

export function normalizeTenantOrder(order = {}) {
  return {
    id: order.id,
    reference: order.reference || '',
    name: order.name || '',
    phone: order.phone || '',
    deliveryType: order.deliveryType || '',
    address: order.address || null,
    notes: order.notes || null,
    totalPrice: typeof order.totalPrice === 'number' ? order.totalPrice : 0,
    status: order.status || 'NEW',
    createdAt: toIsoString(order.createdAt),
    notifyWhenReady: Boolean(order.notifyWhenReady),
    paidOnline: Boolean(order.paidOnline),
    tableId: order.tableId || null,
    tableLabel: order.tableLabel || null,
    tableSlug: order.tableSlug || null,
    orderContext: order.orderContext || 'STANDARD',
    orderSource: order.orderSource || 'CUSTOMER',
    createdByAdminEmail: order.createdByAdminEmail || null,
    table: order.table
      ? {
          id: order.table.id,
          label: order.table.label || '',
          slug: order.table.slug || '',
          zone: order.table.zone || null,
        }
      : null,
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          id: item.id,
          itemId: item.itemId || null,
          menuItemId: item.menuItemId || null,
          name: item.name || '',
          price: typeof item.price === 'number' ? item.price : 0,
          quantity: item.quantity || 0,
        }))
      : [],
  };
}

export function normalizeTenantOrders(orders = []) {
  return orders.map((order) => normalizeTenantOrder(order));
}
