import Link from 'next/link';
import {
  GATEWAY_LEAD_STATUSES,
  getGatewayLeadStatusLabel,
  normalizeGatewayLead,
} from '../../../lib/gateway-leads';
import { prisma } from '../../../lib/prisma';
import { getRestaurantProfile } from '../../../lib/restaurant-profile';

export const dynamic = 'force-dynamic';

function createEmptyLeadCounts() {
  return GATEWAY_LEAD_STATUSES.reduce(
    (counts, status) => ({
      ...counts,
      [status]: 0,
    }),
    {},
  );
}

async function getLeadOverview() {
  const counts = createEmptyLeadCounts();

  if (!process.env.DATABASE_URL) {
    return { counts, total: 0, recentLeads: [] };
  }

  try {
    const [countRows, recentLeadRows] = await Promise.all([
      prisma.gatewayLead.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.gatewayLead.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    for (const row of countRows) {
      if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
        counts[row.status] = row._count._all;
      }
    }

    return {
      counts,
      total: Object.values(counts).reduce((sum, value) => sum + value, 0),
      recentLeads: recentLeadRows.map(normalizeGatewayLead).filter(Boolean),
    };
  } catch (error) {
    console.error('Failed to load platform dashboard leads', error);
    return { counts, total: 0, recentLeads: [] };
  }
}

function formatDate(value) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-neutral-950">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-5 text-neutral-600">{detail}</p> : null}
    </article>
  );
}

function QuickAction({ title, description, href }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-emerald-700 hover:shadow-md"
    >
      <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
    </Link>
  );
}

export default async function PlatformDashboardPage() {
  const [leadOverview, profile] = await Promise.all([
    getLeadOverview(),
    getRestaurantProfile(),
  ]);
  const enabledModuleCount = profile.enabledFeatures.length;

  const metricCards = [
    {
      label: 'Total gateway leads',
      value: leadOverview.total,
      detail: 'Submitted through the public gateway form.',
    },
    {
      label: 'New leads',
      value: leadOverview.counts.NEW,
      detail: 'Waiting for first manual review.',
    },
    {
      label: 'Contacted leads',
      value: leadOverview.counts.CONTACTED,
      detail: 'Manual outreach has started.',
    },
    {
      label: 'Qualified leads',
      value: leadOverview.counts.QUALIFIED,
      detail: 'Good fit for a deeper conversation.',
    },
    {
      label: 'Archived leads',
      value: leadOverview.counts.ARCHIVED,
      detail: 'Closed or parked inquiries.',
    },
    {
      label: 'Demo profile status',
      value: profile.restaurantName,
      detail: profile.tagline,
    },
    {
      label: 'Enabled demo modules',
      value: enabledModuleCount,
      detail: 'Active modules in the demo restaurant profile.',
    },
  ];

  const quickActions = [
    {
      title: 'View gateway leads',
      href: '/platform-admin/leads',
      description: 'Review submitted gateway inquiries, notes, and follow-up state.',
    },
    {
      title: 'Open demo restaurant',
      href: '/public',
      description: 'Inspect the public demo restaurant website and customer flows.',
    },
    {
      title: 'Reset demo profile',
      href: '/platform-admin/demo-restaurant',
      description: 'Return demo branding and contact fields to neutral defaults.',
    },
    {
      title: 'Open restaurant admin',
      href: '/admin',
      description: 'Jump to the demo restaurant operations admin.',
    },
    {
      title: 'View public gateway',
      href: '/',
      description: 'Open the business gateway and lead request form.',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-emerald-950/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Platform owner area</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-950">Platform Dashboard</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
          This is the platform owner admin for the restaurant automation business. It summarizes gateway leads, demo
          profile health, and the fastest links across the public gateway and demo restaurant.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">Recent gateway leads</h2>
              <p className="text-sm text-neutral-600">Latest 5 inquiries from the gateway form.</p>
            </div>
            <Link href="/platform-admin/leads" className="text-sm font-semibold text-emerald-800 hover:underline">
              View all gateway leads
            </Link>
          </div>

          {leadOverview.recentLeads.length ? (
            <div className="divide-y divide-neutral-200">
              {leadOverview.recentLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href="/platform-admin/leads"
                  className="grid gap-2 py-3 text-sm transition hover:bg-neutral-50 sm:grid-cols-[1.2fr_1fr_130px_150px] sm:items-center"
                >
                  <span className="font-semibold text-neutral-950">{lead.restaurantName || 'Unnamed restaurant'}</span>
                  <span className="text-neutral-600">{lead.contactName || 'No contact name'}</span>
                  <span className="w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    {getGatewayLeadStatusLabel(lead.status)}
                  </span>
                  <span className="text-neutral-500">{formatDate(lead.createdAt)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
              <p className="font-semibold text-neutral-700">No gateway leads yet</p>
              <p className="mt-2">Try a walkthrough and submit a lead from the gateway form.</p>
              <Link href="/" className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 font-semibold text-white">
                View public gateway
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-950">Platform quick actions</h2>
          <p className="mt-1 text-sm text-neutral-600">Common owner workflows for the gateway and demo restaurant.</p>
          <div className="mt-4 grid gap-3">
            {quickActions.map((action) => (
              <QuickAction key={action.title} {...action} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
