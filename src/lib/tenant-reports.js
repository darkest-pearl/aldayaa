import {
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_STOCK_STATUSES,
  getInventoryMovementTypeLabel,
  getInventoryStockStatus,
} from './inventory';
import { ORDER_CONTEXTS, ORDER_STATUSES, getOrderContextLabel, getOrderStatusLabel } from './order-status';
import {
  PURCHASE_INVOICE_PAYMENT_STATUSES,
  PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES,
  PURCHASE_INVOICE_STATUSES,
  calculatePurchaseInvoicePaymentSummary,
  getPurchaseInvoicePaymentStatusLabel,
  getPurchaseInvoiceStatusLabel,
} from './purchase-invoices';
import { PURCHASE_REQUEST_STATUSES, getPurchaseRequestStatusLabel } from './purchase-requests';
import { RESERVATION_STATUSES, getReservationStatusLabel } from './reservations';
import { prisma } from './prisma';

const DUBAI_TIME_ZONE = 'Asia/Dubai';
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_CUSTOM_RANGE_DAYS = 366;

export const REPORT_PERIODS = Object.freeze({
  TODAY: 'TODAY',
  THREE_DAYS: 'THREE_DAYS',
  WEEK: 'WEEK',
  BIWEEKLY: 'BIWEEKLY',
  MONTH: 'MONTH',
  QUARTER: 'QUARTER',
  SIX_MONTHS: 'SIX_MONTHS',
  YEAR: 'YEAR',
  CUSTOM: 'CUSTOM',
});

export const REPORT_PERIOD_LABELS = Object.freeze({
  [REPORT_PERIODS.TODAY]: 'Today',
  [REPORT_PERIODS.THREE_DAYS]: '3 days',
  [REPORT_PERIODS.WEEK]: '7 days',
  [REPORT_PERIODS.BIWEEKLY]: '14 days',
  [REPORT_PERIODS.MONTH]: '30 days',
  [REPORT_PERIODS.QUARTER]: '90 days',
  [REPORT_PERIODS.SIX_MONTHS]: '6 months',
  [REPORT_PERIODS.YEAR]: '1 year',
  [REPORT_PERIODS.CUSTOM]: 'Custom',
});

const REPORT_PERIOD_DAYS = Object.freeze({
  [REPORT_PERIODS.TODAY]: 1,
  [REPORT_PERIODS.THREE_DAYS]: 3,
  [REPORT_PERIODS.WEEK]: 7,
  [REPORT_PERIODS.BIWEEKLY]: 14,
  [REPORT_PERIODS.MONTH]: 30,
  [REPORT_PERIODS.QUARTER]: 90,
  [REPORT_PERIODS.SIX_MONTHS]: 183,
  [REPORT_PERIODS.YEAR]: 365,
});

const reportPeriodValues = Object.freeze(Object.values(REPORT_PERIODS));

class TenantReportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function startOfDubaiDayUtc(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const dubaiDate = new Date(date.getTime() + DUBAI_OFFSET_MS);
  dubaiDate.setUTCHours(0, 0, 0, 0);
  return new Date(dubaiDate.getTime() - DUBAI_OFFSET_MS);
}

function parseDateOnly(value, label) {
  const cleanValue = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) {
    throw new TenantReportError(`${label} date is invalid`, 400);
  }

  const date = new Date(`${cleanValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new TenantReportError(`${label} date is invalid`, 400);
  }
  if (date.toISOString().slice(0, 10) !== cleanValue) {
    throw new TenantReportError(`${label} date is invalid`, 400);
  }

  return cleanValue;
}

function dateOnlyToDubaiStartUtc(value, label) {
  const cleanValue = parseDateOnly(value, label);
  return new Date(`${cleanValue}T00:00:00.000+04:00`);
}

function formatDubaiDateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DUBAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value;
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function getCount(row) {
  return row?._count?._all || 0;
}

function mapKnownStatusCounts(values, rows, labeler) {
  const counts = new Map(rows.map((row) => [row.status, getCount(row)]));
  return values.map((status) => ({
    status,
    label: labeler(status),
    count: counts.get(status) || 0,
  }));
}

function mapKnownTypeCounts(values, rows, key, labeler) {
  const counts = new Map(rows.map((row) => [row[key], getCount(row)]));
  return values.map((value) => ({
    value,
    label: labeler(value),
    count: counts.get(value) || 0,
  }));
}

function getDateRangeWhere(field, range) {
  return {
    [field]: {
      gte: range.inclusiveStart,
      lt: range.exclusiveEnd,
    },
  };
}

export function isValidReportPeriod(period) {
  return reportPeriodValues.includes(period);
}

export function getReportPeriodOptions() {
  return reportPeriodValues.map((value) => ({
    value,
    label: REPORT_PERIOD_LABELS[value],
  }));
}

export function resolveTenantReportPeriod({ period = REPORT_PERIODS.WEEK, from, to, now = new Date() } = {}) {
  const normalizedPeriod = typeof period === 'string' ? period.trim().toUpperCase() : REPORT_PERIODS.WEEK;
  if (!isValidReportPeriod(normalizedPeriod)) {
    throw new TenantReportError('Invalid report period', 400);
  }

  if (normalizedPeriod === REPORT_PERIODS.CUSTOM) {
    const inclusiveStart = dateOnlyToDubaiStartUtc(from, 'From');
    const inclusiveToStart = dateOnlyToDubaiStartUtc(to, 'To');
    const exclusiveEnd = addDays(inclusiveToStart, 1);
    const rangeDays = Math.round((exclusiveEnd.getTime() - inclusiveStart.getTime()) / DAY_MS);

    if (rangeDays <= 0) {
      throw new TenantReportError('Custom report range must end on or after the start date', 400);
    }
    if (rangeDays > MAX_CUSTOM_RANGE_DAYS) {
      throw new TenantReportError(`Custom report range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days`, 400);
    }

    return {
      period: normalizedPeriod,
      label: REPORT_PERIOD_LABELS[normalizedPeriod],
      inclusiveStart,
      exclusiveEnd,
      from: formatDubaiDateOnly(inclusiveStart),
      to: formatDubaiDateOnly(addDays(exclusiveEnd, -1)),
      timezone: DUBAI_TIME_ZONE,
      maxCustomRangeDays: MAX_CUSTOM_RANGE_DAYS,
    };
  }

  const days = REPORT_PERIOD_DAYS[normalizedPeriod];
  const todayStart = startOfDubaiDayUtc(now);
  const inclusiveStart = addDays(todayStart, -(days - 1));
  const exclusiveEnd = addDays(todayStart, 1);

  return {
    period: normalizedPeriod,
    label: REPORT_PERIOD_LABELS[normalizedPeriod],
    inclusiveStart,
    exclusiveEnd,
    from: formatDubaiDateOnly(inclusiveStart),
    to: formatDubaiDateOnly(addDays(exclusiveEnd, -1)),
    timezone: DUBAI_TIME_ZONE,
    maxCustomRangeDays: MAX_CUSTOM_RANGE_DAYS,
  };
}

export function normalizeTenantOperationsReport(summary) {
  return {
    period: {
      period: summary.period.period,
      label: summary.period.label,
      from: summary.period.from,
      to: summary.period.to,
      timezone: summary.period.timezone,
      inclusiveStart: summary.period.inclusiveStart.toISOString(),
      exclusiveEnd: summary.period.exclusiveEnd.toISOString(),
      maxCustomRangeDays: summary.period.maxCustomRangeDays,
    },
    generatedAt: summary.generatedAt.toISOString(),
    orderSummary: summary.orderSummary,
    reservationSummary: summary.reservationSummary,
    kitchenSummary: summary.kitchenSummary,
    inventorySummary: summary.inventorySummary,
    recipeSummary: summary.recipeSummary,
    purchaseRequestSummary: summary.purchaseRequestSummary,
    purchaseInvoiceSummary: summary.purchaseInvoiceSummary,
    paymentSummary: summary.paymentSummary,
    boundaries: {
      readOnly: true,
      analyticsAutomation: false,
      paymentProcessing: false,
      inventoryMutation: false,
      vendorMessaging: false,
    },
  };
}

async function buildOrderSummary({ restaurantId, range }) {
  const where = { restaurantId, ...getDateRangeWhere('createdAt', range) };
  const [totals, statusRows, contextRows, orderItems] = await Promise.all([
    prisma.order.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalPrice: true },
      _avg: { totalPrice: true },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ['orderContext'],
      where,
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where,
      select: {
        items: {
          where: { restaurantId },
          select: { quantity: true },
        },
      },
    }),
  ]);

  const count = totals._count._all || 0;
  const byStatus = mapKnownStatusCounts(Object.values(ORDER_STATUSES), statusRows, getOrderStatusLabel);
  const byContext = mapKnownTypeCounts(Object.values(ORDER_CONTEXTS), contextRows, 'orderContext', getOrderContextLabel);

  return {
    totalOrders: count,
    byStatus,
    byContext,
    tableOrderCount: byContext.find((context) => context.value === ORDER_CONTEXTS.TABLE)?.count || 0,
    completedCount: byStatus.find((status) => status.status === ORDER_STATUSES.COMPLETED)?.count || 0,
    cancelledCount: byStatus.find((status) => status.status === ORDER_STATUSES.CANCELLED)?.count || 0,
    revenueAvailable: true,
    totalValue: roundMoney(totals._sum.totalPrice),
    averageOrderValue: count ? roundMoney(totals._avg.totalPrice) : 0,
    itemQuantityCount: orderItems.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + toNumber(item.quantity), 0),
      0,
    ),
  };
}

async function buildReservationSummary({ restaurantId, range, now }) {
  const where = { restaurantId, ...getDateRangeWhere('date', range) };
  const [totalReservations, statusRows, upcomingReservations] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.reservation.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.reservation.count({
      where: {
        restaurantId,
        date: { gte: now },
        status: { not: 'CANCELLED' },
      },
    }),
  ]);

  return {
    totalReservations,
    byStatus: mapKnownStatusCounts(RESERVATION_STATUSES, statusRows, getReservationStatusLabel),
    upcomingReservations,
  };
}

async function buildKitchenSummary({ restaurantId }) {
  const activeWhere = {
    restaurantId,
    status: { notIn: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED] },
  };
  const [activeOrders, statusRows, tableActiveOrders] = await Promise.all([
    prisma.order.count({ where: activeWhere }),
    prisma.order.groupBy({
      by: ['status'],
      where: activeWhere,
      _count: { _all: true },
    }),
    prisma.order.count({
      where: {
        ...activeWhere,
        orderContext: ORDER_CONTEXTS.TABLE,
      },
    }),
  ]);
  const byStatus = mapKnownStatusCounts([ORDER_STATUSES.NEW, ORDER_STATUSES.IN_PROGRESS], statusRows, getOrderStatusLabel);

  return {
    activeOrdersNow: activeOrders,
    newOrders: byStatus.find((status) => status.status === ORDER_STATUSES.NEW)?.count || 0,
    inProgressOrders: byStatus.find((status) => status.status === ORDER_STATUSES.IN_PROGRESS)?.count || 0,
    tableActiveOrderCount: tableActiveOrders,
    byStatus,
  };
}

async function buildInventorySummary({ restaurantId, range }) {
  const [items, movementCount, movementRows] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { restaurantId, isActive: true },
      select: {
        currentStock: true,
        reorderLevel: true,
      },
    }),
    prisma.inventoryMovement.count({
      where: { restaurantId, ...getDateRangeWhere('createdAt', range) },
    }),
    prisma.inventoryMovement.groupBy({
      by: ['type'],
      where: { restaurantId, ...getDateRangeWhere('createdAt', range) },
      _count: { _all: true },
    }),
  ]);
  const movementTypes = Object.values(INVENTORY_MOVEMENT_TYPES);
  const movementsByType = mapKnownTypeCounts(movementTypes, movementRows, 'type', getInventoryMovementTypeLabel);

  return {
    activeItemCount: items.length,
    lowStockCount: items.filter((item) => getInventoryStockStatus(item) === INVENTORY_STOCK_STATUSES.LOW_STOCK).length,
    outOfStockCount: items.filter((item) => getInventoryStockStatus(item) === INVENTORY_STOCK_STATUSES.OUT_OF_STOCK).length,
    recentMovementCount: movementCount,
    inboundMovementCount: movementsByType.find((movement) => movement.value === INVENTORY_MOVEMENT_TYPES.STOCK_IN)?.count || 0,
    outboundMovementCount: movementsByType
      .filter((movement) => [INVENTORY_MOVEMENT_TYPES.STOCK_OUT, INVENTORY_MOVEMENT_TYPES.WASTE].includes(movement.value))
      .reduce((sum, movement) => sum + movement.count, 0),
    movementsByType,
  };
}

async function buildRecipeSummary({ restaurantId, range }) {
  const [menuItems, manualConsumptionApplications] = await Promise.all([
    prisma.menuItem.findMany({
      where: { restaurantId },
      select: {
        ingredients: {
          where: { restaurantId },
          select: {
            inventoryItem: {
              select: {
                currentStock: true,
                reorderLevel: true,
                isActive: true,
              },
            },
          },
        },
      },
    }),
    prisma.orderRecipeConsumption.count({
      where: {
        restaurantId,
        status: 'APPLIED',
        ...getDateRangeWhere('createdAt', range),
      },
    }),
  ]);

  const menuItemsWithRecipes = menuItems.filter((item) => item.ingredients.length > 0);

  return {
    menuItemsWithRecipes: menuItemsWithRecipes.length,
    menuItemsWithoutRecipes: menuItems.length - menuItemsWithRecipes.length,
    lowStockLinkedRecipes: menuItemsWithRecipes.filter((item) =>
      item.ingredients.some((ingredient) =>
        ingredient.inventoryItem &&
        ingredient.inventoryItem.isActive !== false &&
        getInventoryStockStatus(ingredient.inventoryItem) !== INVENTORY_STOCK_STATUSES.OK
      )
    ).length,
    manualConsumptionApplications,
  };
}

async function buildPurchaseRequestSummary({ restaurantId, range }) {
  const periodWhere = { restaurantId, ...getDateRangeWhere('createdAt', range) };
  const [activeSuppliers, statusRows, openRequests, receivedRequestsInPeriod] = await Promise.all([
    prisma.supplier.count({
      where: { restaurantId, isActive: true },
    }),
    prisma.purchaseRequest.groupBy({
      by: ['status'],
      where: periodWhere,
      _count: { _all: true },
    }),
    prisma.purchaseRequest.count({
      where: {
        restaurantId,
        status: { notIn: [PURCHASE_REQUEST_STATUSES.RECEIVED, PURCHASE_REQUEST_STATUSES.CANCELLED] },
      },
    }),
    prisma.purchaseRequest.count({
      where: {
        restaurantId,
        status: PURCHASE_REQUEST_STATUSES.RECEIVED,
        updatedAt: {
          gte: range.inclusiveStart,
          lt: range.exclusiveEnd,
        },
      },
    }),
  ]);

  return {
    activeSuppliers,
    byStatus: mapKnownStatusCounts(Object.values(PURCHASE_REQUEST_STATUSES), statusRows, getPurchaseRequestStatusLabel),
    openRequests,
    receivedRequestsInPeriod,
  };
}

async function buildPurchaseInvoiceSummary({ restaurantId, range }) {
  const periodWhere = { restaurantId, ...getDateRangeWhere('invoiceDate', range) };
  const [statusRows, totals] = await Promise.all([
    prisma.purchaseInvoice.groupBy({
      by: ['status'],
      where: periodWhere,
      _count: { _all: true },
    }),
    prisma.purchaseInvoice.aggregate({
      where: periodWhere,
      _count: { _all: true },
      _sum: {
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
      },
    }),
  ]);
  const byStatus = mapKnownStatusCounts(Object.values(PURCHASE_INVOICE_STATUSES), statusRows, getPurchaseInvoiceStatusLabel);

  return {
    invoiceCount: totals._count._all || 0,
    byStatus,
    draftCount: byStatus.find((status) => status.status === PURCHASE_INVOICE_STATUSES.DRAFT)?.count || 0,
    recordedCount: byStatus.find((status) => status.status === PURCHASE_INVOICE_STATUSES.RECORDED)?.count || 0,
    voidCount: byStatus.find((status) => status.status === PURCHASE_INVOICE_STATUSES.VOID)?.count || 0,
    subtotalAmount: roundMoney(totals._sum.subtotal),
    taxAmount: roundMoney(totals._sum.taxAmount),
    totalAmount: roundMoney(totals._sum.totalAmount),
  };
}

async function buildPaymentSummary({ restaurantId, range }) {
  const [recordedPaymentTotals, voidedPaymentCount, invoices] = await Promise.all([
    prisma.purchaseInvoicePayment.aggregate({
      where: {
        restaurantId,
        status: PURCHASE_INVOICE_PAYMENT_STATUSES.RECORDED,
        ...getDateRangeWhere('paidAt', range),
      },
      _sum: { amount: true },
    }),
    prisma.purchaseInvoicePayment.count({
      where: {
        restaurantId,
        status: PURCHASE_INVOICE_PAYMENT_STATUSES.VOID,
        ...getDateRangeWhere('updatedAt', range),
      },
    }),
    prisma.purchaseInvoice.findMany({
      where: { restaurantId },
      select: {
        status: true,
        totalAmount: true,
        payments: {
          where: { restaurantId },
          select: {
            amount: true,
            status: true,
          },
        },
      },
    }),
  ]);
  const paymentStatuses = invoices.map((invoice) => calculatePurchaseInvoicePaymentSummary(invoice).paymentStatus);

  return {
    recordedPaymentAmount: roundMoney(recordedPaymentTotals._sum.amount),
    voidedPaymentCount,
    unpaidInvoiceCount: paymentStatuses.filter((status) => status === PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES.UNPAID).length,
    partiallyPaidInvoiceCount: paymentStatuses.filter((status) => status === PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES.PARTIALLY_PAID).length,
    paidInvoiceCount: paymentStatuses.filter((status) => status === PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES.PAID).length,
    byPaymentRecordStatus: [
      {
        status: PURCHASE_INVOICE_PAYMENT_STATUSES.RECORDED,
        label: getPurchaseInvoicePaymentStatusLabel(PURCHASE_INVOICE_PAYMENT_STATUSES.RECORDED),
        amount: roundMoney(recordedPaymentTotals._sum.amount),
      },
      {
        status: PURCHASE_INVOICE_PAYMENT_STATUSES.VOID,
        label: getPurchaseInvoicePaymentStatusLabel(PURCHASE_INVOICE_PAYMENT_STATUSES.VOID),
        count: voidedPaymentCount,
      },
    ],
  };
}

export async function getTenantOperationsReport({ restaurantId, period, from, to, now = new Date() }) {
  const resolvedPeriod = resolveTenantReportPeriod({ period, from, to, now });

  const [
    orderSummary,
    reservationSummary,
    kitchenSummary,
    inventorySummary,
    recipeSummary,
    purchaseRequestSummary,
    purchaseInvoiceSummary,
    paymentSummary,
  ] = await Promise.all([
    buildOrderSummary({ restaurantId, range: resolvedPeriod }),
    buildReservationSummary({ restaurantId, range: resolvedPeriod, now }),
    buildKitchenSummary({ restaurantId }),
    buildInventorySummary({ restaurantId, range: resolvedPeriod }),
    buildRecipeSummary({ restaurantId, range: resolvedPeriod }),
    buildPurchaseRequestSummary({ restaurantId, range: resolvedPeriod }),
    buildPurchaseInvoiceSummary({ restaurantId, range: resolvedPeriod }),
    buildPaymentSummary({ restaurantId, range: resolvedPeriod }),
  ]);

  return normalizeTenantOperationsReport({
    period: resolvedPeriod,
    generatedAt: now,
    orderSummary,
    reservationSummary,
    kitchenSummary,
    inventorySummary,
    recipeSummary,
    purchaseRequestSummary,
    purchaseInvoiceSummary,
    paymentSummary,
  });
}
