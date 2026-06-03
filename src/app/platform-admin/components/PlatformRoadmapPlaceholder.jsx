import Link from 'next/link';

export default function PlatformRoadmapPlaceholder({
  eyebrow = 'Roadmap placeholder',
  title,
  description,
  currentState,
  actions = [],
  futureScope = [],
  notImplemented,
}) {
  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-emerald-950/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-950">{title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-600">{description}</p>
        <p className="mt-4 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          {currentState}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-950">Current actions</h2>
          <div className="mt-4 flex flex-col gap-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-lg border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:border-emerald-800 hover:text-emerald-800"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-950">Future scope</h2>
          <ul className="mt-4 grid gap-3 text-sm text-neutral-700 sm:grid-cols-2">
            {futureScope.map((item) => (
              <li key={item} className="rounded-lg bg-neutral-50 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-950">Not implemented yet</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">{notImplemented}</p>
      </section>
    </section>
  );
}
