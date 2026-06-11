export function normalizeSupplier(supplier = {}) {
  return {
    id: supplier.id,
    name: supplier.name || '',
    contactName: supplier.contactName || '',
    phone: supplier.phone || '',
    email: supplier.email || '',
    whatsapp: supplier.whatsapp || '',
    address: supplier.address || '',
    notes: supplier.notes || '',
    isActive: supplier.isActive !== false,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}

export function normalizeSuppliers(suppliers = []) {
  return suppliers.map(normalizeSupplier);
}
