import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { INVENTORY_STOCK_STATUSES, getInventoryStockStatus } from '../../../../lib/inventory';
import { ORDER_CONTEXTS, ORDER_STATUSES } from '../../../../lib/order-status';
import { prisma } from '../../../../lib/prisma';
import {
  PURCHASE_INVOICE_PAYMENT_STATUSES,
  PURCHASE_INVOICE_STATUSES,
  calculatePurchaseInvoicePaymentSummary,
} from '../../../../lib/purchase-invoices';
import { PURCHASE_REQUEST_STATUSES } from '../../../../lib/purchase-requests';
import { requireRestaurantStaffAccess } from '../../../../lib/restaurant-staff-access';
import { getMenuItemIngredientCount } from '../../../../lib/recipes';
import TenantAdminNav from './TenantAdminNav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Restaurant Staff Admin' };

export default async function TenantRestaurantAdminPage({ params }) {
  let staff;

  try {
    staff = await requireRestaurantStaffAccess(cookies(), params.restaurantSlug);
  } catch (error) {
    redirect(`/r/${params.restaurantSlug}/admin/login`);
  }

  const [
    kitchenOrders,
    inventoryItems,
    recentMovementCount,
    recipeMenuItems,
    activeSupplierCount,
    purchaseRequests,
    purchaseInvoices,
  ] = await Promise.all([
    prisma.order.findMany({
      where: {
        restaurantId: staff.restaurantId,
        status: { notIn: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED] },
      },
      select: {
        status: true,
        orderContext: true,
      },
    }),
    prisma.inventoryItem.findMany({
      where: { restaurantId: staff.restaurantId },
      select: {
        currentStock: true,
        reorderLevel: true,
        isActive: true,
      },
    }),
    prisma.inventoryMovement.count({
      where: { restaurantId: staff.restaurantId },
    }),
    prisma.menuItem.findMany({
      where: { restaurantId: staff.restaurantId },
      select: {
        id: true,
        ingredients: {
          where: { restaurantId: staff.restaurantId },
          select: {
            id: true,
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
    prisma.supplier.count({
      where: { restaurantId: staff.restaurantId, isActive: true },
    }),
    prisma.purchaseRequest.findMany({
      where: { restaurantId: staff.restaurantId },
      select: { status: true },
    }),
    prisma.purchaseInvoice.findMany({
      where: { restaurantId: staff.restaurantId },
      select: {
        status: true,
        totalAmount: true,
        payments: {
          where: {
            restaurantId: staff.restaurantId,
            status: PURCHASE_INVOICE_PAYMENT_STATUSES.RECORDED,
          },
          select: {
            amount: true,
            status: true,
          },
        },
      },
    }),
  ]);

  const kitchenCounters = kitchenOrders.reduce(
    (counts, order) => {
      counts.activeOrders += 1;
      counts.byStatus[order.status] = (counts.byStatus[order.status] || 0) + 1;
      if ((order.orderContext || ORDER_CONTEXTS.STANDARD) === ORDER_CONTEXTS.TABLE) {
        counts.tableOrders += 1;
      }
      return counts;
    },
    {
      activeOrders: 0,
      tableOrders: 0,
      byStatus: {
        [ORDER_STATUSES.NEW]: 0,
        [ORDER_STATUSES.IN_PROGRESS]: 0,
      },
    },
  );
  const inventoryCounters = {
    totalItems: inventoryItems.length,
    lowStockItems: inventoryItems.filter((item) =>
      item.isActive !== false && getInventoryStockStatus(item) !== INVENTORY_STOCK_STATUSES.OK,
    ).length,
    recentMovements: recentMovementCount,
  };
  const recipeCounters = {
    totalRecipes: recipeMenuItems.filter((item) => getMenuItemIngredientCount(item) > 0).length,
    menuItemsWithoutRecipes: recipeMenuItems.filter((item) => getMenuItemIngredientCount(item) === 0).length,
    lowStockLinkedRecipes: recipeMenuItems.filter((item) =>
      item.ingredients.some((ingredient) =>
        ingredient.inventoryItem &&
        ingredient.inventoryItem.isActive !== false &&
        getInventoryStockStatus(ingredient.inventoryItem) !== INVENTORY_STOCK_STATUSES.OK
      )
    ).length,
  };
  const purchaseRequestCounters = {
    activeSuppliers: activeSupplierCount,
    totalRequests: purchaseRequests.length,
    openRequests: purchaseRequests.filter((request) =>
      ![PURCHASE_REQUEST_STATUSES.RECEIVED, PURCHASE_REQUEST_STATUSES.CANCELLED].includes(request.status)
    ).length,
    receivedRequests: purchaseRequests.filter((request) => request.status === PURCHASE_REQUEST_STATUSES.RECEIVED).length,
  };
  const purchaseInvoiceCounters = {
    totalInvoices: purchaseInvoices.length,
    draftInvoices: purchaseInvoices.filter((invoice) => invoice.status === PURCHASE_INVOICE_STATUSES.DRAFT).length,
    recordedInvoices: purchaseInvoices.filter((invoice) => invoice.status === PURCHASE_INVOICE_STATUSES.RECORDED).length,
    voidInvoices: purchaseInvoices.filter((invoice) => invoice.status === PURCHASE_INVOICE_STATUSES.VOID).length,
  };
  const purchaseInvoicePaymentSummaries = purchaseInvoices.map((invoice) => calculatePurchaseInvoicePaymentSummary(invoice));
  const paymentCounters = {
    unpaidInvoices: purchaseInvoicePaymentSummaries.filter((summary) => summary.paymentStatus === 'UNPAID').length,
    partiallyPaidInvoices: purchaseInvoicePaymentSummaries.filter((summary) => summary.paymentStatus === 'PARTIALLY_PAID').length,
    paidInvoices: purchaseInvoicePaymentSummaries.filter((summary) => summary.paymentStatus === 'PAID').length,
    totalRecordedPaymentAmount: purchaseInvoices.reduce(
      (sum, invoice) => sum + invoice.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0),
      0,
    ),
  };

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <TenantAdminNav restaurantSlug={params.restaurantSlug} active="overview" staff={staff} />
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950 md:col-span-2">
          <span className="font-semibold">Restaurant staff access is active.</span> Tenant-scoped menu, gallery, profile, settings, staff management, reservations, tables, order status management, kitchen queue operations, inventory management, recipe linkage, supplier records, manual purchase requests, purchase invoice recording, and manual purchase invoice payment records are available now.
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Menu management</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Manage categories, dishes, pricing, availability, recommendations, signature items, and image URLs for this tenant only.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/menu`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open menu
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Gallery management</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Manage gallery categories and photo metadata for this tenant. Upload storage remains a future enhancement.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/gallery`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open gallery
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Profile and settings</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Manage public profile metadata, contact links, brand colors, display hours, and cancellation settings for this tenant only.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/settings`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open settings
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Staff management</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            OWNER users can create, update, deactivate, and manually reset passwords for RestaurantUser records in this tenant only.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/staff`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open staff
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Reservations</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            View bookings and update reservation status for this tenant only. No messaging, ordering, or payment workflow is triggered.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/reservations`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open reservations
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Tables</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Create and manage table labels, zones, seats, active state, QR token references, and tenant QR order links for this tenant only.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/tables`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open tables
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Orders</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            View tenant orders and update order status for this restaurant. This is a read/status management foundation; public tenant ordering creates orders only when ONLINE_ORDERING is enabled.
          </p>
          <a
            href={`/r/${params.restaurantSlug}/admin/orders`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open orders
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Kitchen queue</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Monitor the active prep queue and update kitchen order status for this tenant only. Completed and cancelled orders are excluded.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Active</span>
              <span className="text-lg font-semibold">{kitchenCounters.activeOrders}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Table</span>
              <span className="text-lg font-semibold">{kitchenCounters.tableOrders}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">New</span>
              <span className="text-lg font-semibold">{kitchenCounters.byStatus[ORDER_STATUSES.NEW] || 0}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">In progress</span>
              <span className="text-lg font-semibold">{kitchenCounters.byStatus[ORDER_STATUSES.IN_PROGRESS] || 0}</span>
            </div>
          </div>
          <a
            href={`/r/${params.restaurantSlug}/admin/kitchen`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open kitchen
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Inventory</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Manage inventory items and low-stock visibility for this tenant only. Manual inventory movements are tracked without order or recipe automation.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Items</span>
              <span className="text-lg font-semibold">{inventoryCounters.totalItems}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Low</span>
              <span className="text-lg font-semibold">{inventoryCounters.lowStockItems}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Moves</span>
              <span className="text-lg font-semibold">{inventoryCounters.recentMovements}</span>
            </div>
          </div>
          <a
            href={`/r/${params.restaurantSlug}/admin/inventory`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open inventory
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Recipes</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Link menu items to tenant inventory ingredients for recipe visibility and estimated cost. No automatic stock depletion or order consumption is triggered.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Recipes</span>
              <span className="text-lg font-semibold">{recipeCounters.totalRecipes}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Unmapped</span>
              <span className="text-lg font-semibold">{recipeCounters.menuItemsWithoutRecipes}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Low stock</span>
              <span className="text-lg font-semibold">{recipeCounters.lowStockLinkedRecipes}</span>
            </div>
          </div>
          <a
            href={`/r/${params.restaurantSlug}/admin/recipes`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open recipes
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Suppliers</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Manage vendor contact records for this tenant. Supplier records are internal references only; nothing is sent automatically.
          </p>
          <div className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Active suppliers</span>
            <span className="text-lg font-semibold">{purchaseRequestCounters.activeSuppliers}</span>
          </div>
          <a
            href={`/r/${params.restaurantSlug}/admin/suppliers`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open suppliers
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Purchase requests</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Review low-stock inventory, create manual purchase request drafts, and receive full requests. Manual receiving increases stock and creates movement history.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Requests</span>
              <span className="text-lg font-semibold">{purchaseRequestCounters.totalRequests}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Open</span>
              <span className="text-lg font-semibold">{purchaseRequestCounters.openRequests}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Received</span>
              <span className="text-lg font-semibold">{purchaseRequestCounters.receivedRequests}</span>
            </div>
          </div>
          <a
            href={`/r/${params.restaurantSlug}/admin/purchase-requests`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open purchase requests
          </a>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Available now</p>
          <h2 className="mt-2 text-xl font-semibold">Purchase invoices</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Record supplier invoice details, manual line totals, and manual payment records for this tenant. Invoice payment records do not process real payments.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Invoices</span>
              <span className="text-lg font-semibold">{purchaseInvoiceCounters.totalInvoices}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Recorded</span>
              <span className="text-lg font-semibold">{purchaseInvoiceCounters.recordedInvoices}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Draft</span>
              <span className="text-lg font-semibold">{purchaseInvoiceCounters.draftInvoices}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Void</span>
              <span className="text-lg font-semibold">{purchaseInvoiceCounters.voidInvoices}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Unpaid</span>
              <span className="text-lg font-semibold">{paymentCounters.unpaidInvoices}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Partial</span>
              <span className="text-lg font-semibold">{paymentCounters.partiallyPaidInvoices}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Paid</span>
              <span className="text-lg font-semibold">{paymentCounters.paidInvoices}</span>
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Recorded payments</span>
              <span className="text-lg font-semibold">AED {paymentCounters.totalRecordedPaymentAmount.toFixed(2)}</span>
            </div>
          </div>
          <a
            href={`/r/${params.restaurantSlug}/admin/purchase-invoices`}
            className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white"
          >
            Open purchase invoices
          </a>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 md:col-span-2">
          Assisted ordering, automatic vendor sending, payment reconciliation, advanced kitchen automation, automatic inventory consumption, advanced staff workflows, billing, domains, email, and WhatsApp automation remain future tenant admin work.
        </div>
      </section>
    </main>
  );
}
