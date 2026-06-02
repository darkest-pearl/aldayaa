import Link from 'next/link';

const overviewItems = [
  {
    title: 'Gateway Leads',
    description: 'Review submitted restaurant inquiries, status, private notes, and manual follow-up state.',
    href: '/platform-admin/leads',
    action: 'Open leads',
  },
  {
    title: 'Gateway Website',
    description: 'Coming later: manage public platform content for the business gateway.',
    href: '/platform-admin/gateway-website',
    action: 'View placeholder',
  },
  {
    title: 'Packages',
    description: 'Coming later: define package copy for sales planning without billing logic.',
    href: '/platform-admin/packages',
    action: 'View placeholder',
  },
];

export default function PlatformDashboardPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-emerald-950/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Platform owner area</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-950">Platform Dashboard</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
          This is the platform owner admin for the restaurant automation business. Use it for gateway workflows that
          do not belong inside the demo restaurant operations admin.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {overviewItems.map((item) => (
          <article key={item.title} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-950">{item.title}</h2>
            <p className="mt-2 min-h-16 text-sm leading-6 text-neutral-600">{item.description}</p>
            <Link
              href={item.href}
              className="mt-4 inline-flex rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1b3b33]"
            >
              {item.action}
            </Link>
          </article>
        ))}
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 text-sm leading-6 text-neutral-700">
        <p>
          Architecture: <code>`/` is the platform/business gateway</code>, <code>`/public` is the demo restaurant website</code>,
          <code> `/admin` is the demo restaurant admin</code>, and <code> `/platform-admin` is the platform owner admin</code>.
        </p>
      </section>
    </div>
  );
}
