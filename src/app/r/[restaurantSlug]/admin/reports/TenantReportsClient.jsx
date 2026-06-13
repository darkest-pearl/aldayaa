'use client';

import { useEffect, useMemo, useState } from 'react';

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';

const periodOptions = [
  { value: 'TODAY', label: 'Today' },
  { value: 'THREE_DAYS', label: '3 days' },
  { value: 'WEEK', label: '7 days' },
  { value: 'BIWEEKLY', label: '14 days' },
  { value: 'MONTH', label: '30 days' },
  { value: 'QUARTER', label: '90 days' },
  { value: 'SIX_MONTHS', label: '6 months' },
  { value: 'YEAR', label: '1 year' },
  { value: 'CUSTOM', label: 'Custom' },
];

async function apiRequest(url) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  const payload = await response.json();
  if (!payload?.success) throw new Error(payload?.error || 'Request failed');
  return payload.data;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatMoney(value, currency = 'AED') {
  return `${currency} ${formatNumber(value)}`;
}

function formatDateTime(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString();
}

function MetricCard({ label, value, tone = 'neutral' }) {
  const toneClass = tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
    : tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-neutral-200 bg-white text-neutral-950';

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-normal opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function CountTable({ title, rows, valueKey = 'count' }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-3 overflow-hidden rounded-md border border-neutral-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-normal text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Label</th>
              <th className="px-3 py-2 text-right font-semibold">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows?.length ? rows.map((row) => (
              <tr key={`${title}-${row.status || row.value || row.label}`} className="border-t border-neutral-100">
                <td className="px-3 py-2">{row.label || row.status || row.value}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatNumber(row[valueKey])}</td>
              </tr>
            )) : (
              <tr>
                <td className="px-3 py-4 text-neutral-500" colSpan={2}>No rows for this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-sm leading-6 text-neutral-600">{description}</p> : null}
    </div>
  );
}

export default function TenantReportsClient({ restaurantSlug, staffRole }) {
  const [period, setPeriod] = useState('WEEK');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const orderSummary = report?.orderSummary;
  const reservationSummary = report?.reservationSummary;
  const kitchenSummary = report?.kitchenSummary;
  const inventorySummary = report?.inventorySummary;
  const recipeSummary = report?.recipeSummary;
  const purchaseRequestSummary = report?.purchaseRequestSummary;
  const purchaseInvoiceSummary = report?.purchaseInvoiceSummary;
  const paymentSummary = report?.paymentSummary;

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ restaurantSlug, period });
    if (period === 'CUSTOM') {
      if (from) params.set('from', from);
      if (to) params.set('to', to);
    }
    return params.toString();
  }, [from, period, restaurantSlug, to]);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/restaurant-admin/reports/summary?${queryString}`);
      setReport(data.report);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading reports...</div> : null}

      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
        Reporting is read-only. No analytics automation. No payment processing. No inventory mutation. No vendor/email/WhatsApp sending. SUPPORT can view reports.
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-neutral-700">
              Period
              <select className={inputClass} value={period} onChange={(event) => setPeriod(event.target.value)}>
                {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-neutral-700">
              From
              <input className={inputClass} type="date" disabled={period !== 'CUSTOM'} value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-neutral-700">
              To
              <input className={inputClass} type="date" disabled={period !== 'CUSTOM'} value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </div>
          <button type="button" onClick={() => load(false)} disabled={loading} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50">
            Refresh
          </button>
        </div>
        {report ? (
          <p className="mt-3 text-xs text-neutral-500">
            {report.period.label}: {report.period.from} to {report.period.to} ({report.period.timezone}). Generated {formatDateTime(report.generatedAt)}.
          </p>
        ) : null}
      </section>

      {!report && !loading ? (
        <p className="rounded-md border border-dashed border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-500">
          No report data is available for the selected period.
        </p>
      ) : null}

      {report ? (
        <>
          <section className="space-y-3">
            <SectionHeader title="Orders" description="Order volume, context, status, value, and item quantity for the selected period." />
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard label="Orders" value={formatNumber(orderSummary.totalOrders)} tone="emerald" />
              <MetricCard label="Revenue" value={formatMoney(orderSummary.totalValue)} />
              <MetricCard label="Avg. order" value={formatMoney(orderSummary.averageOrderValue)} />
              <MetricCard label="Item qty" value={formatNumber(orderSummary.itemQuantityCount)} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <CountTable title="Orders by status" rows={orderSummary.byStatus} />
              <CountTable title="Orders by context" rows={orderSummary.byContext} />
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader title="Reservations" description="Reservation volume and upcoming reservations using the reservation date fields." />
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Reservations" value={formatNumber(reservationSummary.totalReservations)} tone="emerald" />
              <MetricCard label="Upcoming" value={formatNumber(reservationSummary.upcomingReservations)} />
              <MetricCard label="Cancelled" value={formatNumber(reservationSummary.byStatus.find((row) => row.status === 'CANCELLED')?.count || 0)} />
            </div>
            <CountTable title="Reservations by status" rows={reservationSummary.byStatus} />
          </section>

          <section className="space-y-3">
            <SectionHeader title="Kitchen" description="Current active kitchen queue counts, independent of the selected period." />
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard label="Active now" value={formatNumber(kitchenSummary.activeOrdersNow)} tone="amber" />
              <MetricCard label="New" value={formatNumber(kitchenSummary.newOrders)} />
              <MetricCard label="In progress" value={formatNumber(kitchenSummary.inProgressOrders)} />
              <MetricCard label="Table active" value={formatNumber(kitchenSummary.tableActiveOrderCount)} />
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader title="Inventory" description="Current stock health plus movement counts for the selected period." />
            <div className="grid gap-3 md:grid-cols-5">
              <MetricCard label="Active items" value={formatNumber(inventorySummary.activeItemCount)} tone="emerald" />
              <MetricCard label="Low stock" value={formatNumber(inventorySummary.lowStockCount)} />
              <MetricCard label="Out of stock" value={formatNumber(inventorySummary.outOfStockCount)} />
              <MetricCard label="Movements" value={formatNumber(inventorySummary.recentMovementCount)} />
              <MetricCard label="Inbound" value={formatNumber(inventorySummary.inboundMovementCount)} />
            </div>
            <CountTable title="Movements by type" rows={inventorySummary.movementsByType} />
          </section>

          <section className="space-y-3">
            <SectionHeader title="Recipes" description="Recipe coverage and manual recipe consumption application counts." />
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard label="With recipes" value={formatNumber(recipeSummary.menuItemsWithRecipes)} tone="emerald" />
              <MetricCard label="Without recipes" value={formatNumber(recipeSummary.menuItemsWithoutRecipes)} />
              <MetricCard label="Low-stock recipes" value={formatNumber(recipeSummary.lowStockLinkedRecipes)} />
              <MetricCard label="Manual applies" value={formatNumber(recipeSummary.manualConsumptionApplications)} />
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader title="Suppliers and purchase requests" description="Supplier count, request status mix, and received request activity." />
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Active suppliers" value={formatNumber(purchaseRequestSummary.activeSuppliers)} tone="emerald" />
              <MetricCard label="Open requests" value={formatNumber(purchaseRequestSummary.openRequests)} />
              <MetricCard label="Received in period" value={formatNumber(purchaseRequestSummary.receivedRequestsInPeriod)} />
            </div>
            <CountTable title="Purchase requests by status" rows={purchaseRequestSummary.byStatus} />
          </section>

          <section className="space-y-3">
            <SectionHeader title="Purchase invoices" description="Invoice status counts and supplier invoice totals for the selected invoice date range." />
            <div className="grid gap-3 md:grid-cols-5">
              <MetricCard label="Invoices" value={formatNumber(purchaseInvoiceSummary.invoiceCount)} tone="emerald" />
              <MetricCard label="Subtotal" value={formatMoney(purchaseInvoiceSummary.subtotalAmount)} />
              <MetricCard label="Tax" value={formatMoney(purchaseInvoiceSummary.taxAmount)} />
              <MetricCard label="Total" value={formatMoney(purchaseInvoiceSummary.totalAmount)} />
              <MetricCard label="Recorded" value={formatNumber(purchaseInvoiceSummary.recordedCount)} />
            </div>
            <CountTable title="Purchase invoices by status" rows={purchaseInvoiceSummary.byStatus} />
          </section>

          <section className="space-y-3">
            <SectionHeader title="Manual invoice payments" description="Manual payment record summaries only; no real payment processing is connected." />
            <div className="grid gap-3 md:grid-cols-5">
              <MetricCard label="Recorded amount" value={formatMoney(paymentSummary.recordedPaymentAmount)} tone="emerald" />
              <MetricCard label="Voided payments" value={formatNumber(paymentSummary.voidedPaymentCount)} />
              <MetricCard label="Unpaid invoices" value={formatNumber(paymentSummary.unpaidInvoiceCount)} />
              <MetricCard label="Partial invoices" value={formatNumber(paymentSummary.partiallyPaidInvoiceCount)} />
              <MetricCard label="Paid invoices" value={formatNumber(paymentSummary.paidInvoiceCount)} />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
