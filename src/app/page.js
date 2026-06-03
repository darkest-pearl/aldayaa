import GatewayLeadForm from '../components/GatewayLeadForm';

export const metadata = {
  title: 'Restaurant automation system | Platform gateway',
  description:
    'A restaurant automation gateway for digital menus, ordering, table QR, kitchen queue, inventory, recipes, and configurable restaurant operations.',
};

const modules = [
  {
    title: 'Digital menu and ordering',
    description: 'Publish menu updates, collect customer orders, and keep order totals priced from the database.',
  },
  {
    title: 'QR table ordering',
    description: 'Give each table a secure QR landing page that carries table context into the order flow.',
  },
  {
    title: 'Waiter-assisted ordering',
    description: 'Let staff create orders for guests using the same safe menu pricing rules as public ordering.',
  },
  {
    title: 'Kitchen queue',
    description: 'Show active orders and move them through the existing status workflow without a full POS build.',
  },
  {
    title: 'Inventory management',
    description: 'Track stock items, units, low-stock states, and manual stock movements for operations teams.',
  },
  {
    title: 'Recipe and stock foundation',
    description: 'Map menu items to inventory ingredients and apply recipe consumption manually after review.',
  },
  {
    title: 'Restaurant configuration',
    description: 'Manage the live restaurant profile, colors, contact details, links, and enabled modules.',
  },
];

const packages = [
  {
    key: 'STARTER',
    name: 'Starter',
    targetRestaurantType: 'Small restaurants, cafes, bakeries, and single-location teams starting online.',
    bestFor: 'A polished public website/menu, easier contact flow, and a clean demo-first launch.',
    implementationStyle: 'Launch the public presence first, then decide which ordering modules should come next.',
    pricingLanguage: 'Custom quote',
    modules: ['Public website/menu', 'Reservation/contact flows', 'Gallery and announcements', 'Restaurant profile setup'],
    ctaLabel: 'Request Starter',
    ctaHref: '/?package=STARTER#request-demo',
  },
  {
    key: 'OPERATIONS',
    name: 'Operations',
    targetRestaurantType: 'Busy dine-in or takeaway restaurants that need live order handling.',
    bestFor: 'Teams ready to connect online ordering, QR table ordering, waiter-assisted ordering, and kitchen visibility.',
    implementationStyle: 'Configure the order flow with the demo, then phase staff workflows into daily operations.',
    pricingLanguage: 'Custom quote',
    modules: ['Online ordering', 'QR table ordering', 'Waiter-assisted ordering', 'Kitchen queue'],
    ctaLabel: 'Request Operations',
    ctaHref: '/?package=OPERATIONS#request-demo',
  },
  {
    key: 'ADVANCED_CUSTOM',
    name: 'Advanced / Custom',
    targetRestaurantType: 'Restaurants with stock control needs, special service flows, or custom operating rules.',
    bestFor: 'Inventory management, recipe/stock deduction foundation, and custom workflows planned around the restaurant.',
    implementationStyle: 'Map the workflow together after the demo and confirm scope before implementation starts.',
    pricingLanguage: 'Starting point discussed after demo',
    modules: ['Inventory management', 'Recipe/stock deduction foundation', 'Custom workflows', 'Module mix planning'],
    ctaLabel: 'Request Advanced / Custom',
    ctaHref: '/?package=ADVANCED_CUSTOM#request-demo',
  },
];

const packageComparison = [
  {
    module: 'Public website/menu',
    starter: 'Included',
    operations: 'Included',
    advanced: 'Included',
  },
  {
    module: 'Reservation/contact flows',
    starter: 'Included',
    operations: 'Included',
    advanced: 'Included',
  },
  {
    module: 'Online ordering',
    starter: 'Optional',
    operations: 'Included',
    advanced: 'Included',
  },
  {
    module: 'QR table ordering',
    starter: 'Optional',
    operations: 'Included',
    advanced: 'Included',
  },
  {
    module: 'Waiter-assisted ordering',
    starter: 'Not included',
    operations: 'Included',
    advanced: 'Included',
  },
  {
    module: 'Kitchen queue',
    starter: 'Not included',
    operations: 'Included',
    advanced: 'Included',
  },
  {
    module: 'Inventory management',
    starter: 'Not included',
    operations: 'Optional',
    advanced: 'Included',
  },
  {
    module: 'Recipe/stock deduction foundation',
    starter: 'Not included',
    operations: 'Optional',
    advanced: 'Included',
  },
  {
    module: 'Custom workflows',
    starter: 'Scoped add-on',
    operations: 'Scoped add-on',
    advanced: 'Custom',
  },
];

const packageLabels = {
  STARTER: 'Starter',
  OPERATIONS: 'Operations',
  ADVANCED_CUSTOM: 'Advanced / Custom',
};

const faqs = [
  {
    question: 'Is this already a SaaS platform?',
    answer:
      'Not yet. This batch adds the business gateway foundation while the application remains a single configured restaurant system.',
  },
  {
    question: 'Can we see the live restaurant experience?',
    answer:
      'Yes. Demo Restaurant is the live demo at /public, with menu, ordering, reservations, gallery, and contact flows available for review.',
  },
  {
    question: 'Does this include subscriptions or payments?',
    answer:
      'No. Payments, subscription billing, and automatic restaurant provisioning are intentionally outside this batch.',
  },
  {
    question: 'Can modules be customized for a restaurant?',
    answer:
      'Yes. The current foundation supports module planning and configuration discussions before any full multi-tenant rollout.',
  },
];

function SectionHeading({ title, description }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h2 className="text-3xl font-semibold leading-tight text-secondary sm:text-4xl">{title}</h2>
      {description ? <p className="mt-4 text-base text-neutral-700 sm:text-lg">{description}</p> : null}
    </div>
  );
}

function getInitialPackageInterest(searchParams) {
  const rawPackage = Array.isArray(searchParams?.package) ? searchParams.package[0] : searchParams?.package;
  return packageLabels[rawPackage] ? rawPackage : '';
}

function GatewayNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="site-container flex items-center justify-between py-5 text-white">
        <a href="/" className="text-lg font-semibold tracking-normal">
          RestaurantOps Gateway
        </a>
        <nav className="hidden items-center gap-6 text-sm font-medium text-white/80 md:flex">
          <a className="transition hover:text-white" href="#modules">
            Modules
          </a>
          <a className="transition hover:text-white" href="#packages">
            Packages
          </a>
          <a className="transition hover:text-white" href="#faq">
            FAQ
          </a>
        </nav>
        <a
          href="#request-demo"
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-secondary shadow-sm transition hover:bg-primary hover:text-white"
        >
          Request customization
        </a>
      </div>
    </header>
  );
}

export default function BusinessGatewayPage({ searchParams = {} }) {
  const initialPackageInterest = getInitialPackageInterest(searchParams);

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-textdark">
      <section
        className="relative min-h-[92vh] overflow-hidden bg-secondary text-white"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(18, 15, 13, 0.88), rgba(18, 15, 13, 0.58), rgba(18, 15, 13, 0.26)), url('/images/interior-2.jpg')",
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      >
        <GatewayNav />
        <div className="site-container relative z-10 flex min-h-[92vh] items-center pb-16 pt-28">
          <div className="max-w-3xl">
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              Restaurant automation system
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80 sm:text-xl">
              A configurable operations platform for restaurants that need digital menus, online ordering, table QR,
              staff-assisted orders, kitchen visibility, inventory, and recipe stock control.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="/public"
                className="rounded-full bg-[#2f7d5b] px-6 py-3 text-sm font-semibold text-white shadow-lifted transition hover:bg-[#255f48]"
              >
                View Demo Restaurant live demo
              </a>
              <a
                href="#request-demo"
                className="rounded-full border border-white/40 bg-white/12 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white hover:text-secondary"
              >
                Request customization
              </a>
              <a
                href="#request-demo"
                className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
              >
                Discuss customization
              </a>
              <a
                href="#modules"
                className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
              >
                Explore modules
              </a>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-10 h-24 bg-gradient-to-t from-[#f4f7f5] to-transparent" />
      </section>

      <section className="py-20">
        <div className="site-container grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold leading-tight text-secondary sm:text-4xl">
              Restaurants need systems that match service speed.
            </h2>
            <p className="mt-5 text-base leading-8 text-neutral-700">
              Many restaurants run public ordering, table service, stock updates, staff handoffs, and WhatsApp follow-up
              through disconnected tools. This gateway introduces a focused product foundation that brings those flows
              into one configurable restaurant operations layer.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Current pressure', 'Manual order taking, changing menus, stock surprises, and weak operational visibility.'],
              ['Product answer', 'A modular restaurant automation system that can start small and expand carefully.'],
              ['Live proof', 'Demo Restaurant is the live demo, so owners can inspect the real customer flow before discussing customization.'],
              ['Architecture', '`/` is the platform/business gateway. `/public` is the demo restaurant website. `/admin` is the demo restaurant admin. `/platform-admin` is the platform owner admin.'],
              ['Next step', 'Capture requirements before adding billing, provisioning, or tenant automation.'],
            ].map(([title, description]) => (
              <article key={title} className="rounded-lg border border-neutral-200 bg-white p-6 shadow-soft">
                <h3 className="text-lg font-semibold text-secondary">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-700">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="bg-white py-20">
        <div className="site-container">
          <SectionHeading
            title="Core restaurant automation modules"
            description="The foundation is organized around modules that restaurant owners can understand, evaluate, and phase in without a broad SaaS rollout yet."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <article key={module.title} className="rounded-lg border border-neutral-200 bg-[#f9fbfa] p-6">
                <h3 className="text-xl font-semibold text-secondary">{module.title}</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-700">{module.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="packages" className="py-20">
        <div className="site-container">
          <SectionHeading
            title="Example packages for discussion"
            description="These example packages are placeholders for discussion, not final pricing, billing plans, subscriptions, or automated provisioning. The packages are examples for discussion; final scope and price are confirmed after a demo, restaurants can mix modules, and this is not self-serve billing yet."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {packages.map((tier) => (
              <article key={tier.name} className="rounded-lg border border-neutral-200 bg-white p-7 shadow-soft">
                <div className="flex min-h-[92px] flex-col justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-normal text-[#2f7d5b]">{tier.pricingLanguage}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-secondary">{tier.name}</h3>
                  </div>
                  <a
                    href={tier.ctaHref}
                    className="inline-flex w-fit rounded-full bg-[#143a31] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2f7d5b]"
                  >
                    {tier.ctaLabel}
                  </a>
                </div>

                <dl className="mt-6 space-y-4 text-sm">
                  <div>
                    <dt className="font-semibold text-secondary">Target restaurant type</dt>
                    <dd className="mt-1 leading-6 text-neutral-700">{tier.targetRestaurantType}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-secondary">Best for</dt>
                    <dd className="mt-1 leading-6 text-neutral-700">{tier.bestFor}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-secondary">Implementation style</dt>
                    <dd className="mt-1 leading-6 text-neutral-700">{tier.implementationStyle}</dd>
                  </div>
                </dl>

                <h4 className="mt-6 text-sm font-semibold text-secondary">Included modules</h4>
                <ul className="mt-3 space-y-3 text-sm text-neutral-800">
                  {tier.modules.map((module) => (
                    <li key={module} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#2f7d5b]" />
                      <span>{module}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-12 rounded-lg border border-neutral-200 bg-white p-4 shadow-soft sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-secondary">Package comparison</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-700">
                  Use this as a planning guide. Module mixes can change after the demo and before a custom quote is
                  confirmed.
                </p>
              </div>
              <a
                href="#request-demo"
                className="inline-flex w-fit rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-secondary transition hover:border-secondary"
              >
                Request a module mix
              </a>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-[760px]">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                    <th className="py-3 pr-4 font-semibold">Module</th>
                    <th className="px-4 py-3 font-semibold">Starter</th>
                    <th className="px-4 py-3 font-semibold">Operations</th>
                    <th className="px-4 py-3 font-semibold">Advanced / Custom</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {packageComparison.map((row) => (
                    <tr key={row.module}>
                      <th className="py-3 pr-4 text-left font-semibold text-secondary">{row.module}</th>
                      <td className="px-4 py-3">{row.starter}</td>
                      <td className="px-4 py-3">{row.operations}</td>
                      <td className="px-4 py-3">{row.advanced}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="request-demo" className="bg-[#143a31] py-20 text-white">
        <div className="site-container grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <h2 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Tell us what to customize.
            </h2>
            <p className="mt-5 text-base leading-8 text-white/75">
              Share the restaurant profile, the modules you care about, and any custom workflow needs. This form creates
              a gateway lead only. It does not create a restaurant account or provision a new tenant.
            </p>
            <a
              href="/public"
              className="mt-8 inline-flex rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-secondary"
            >
              View Demo Restaurant live demo
            </a>
          </div>
          <GatewayLeadForm initialPackageInterest={initialPackageInterest} />
        </div>
      </section>

      <section id="faq" className="py-20">
        <div className="site-container">
          <SectionHeading
            title="Questions before the next batch"
            description="This gateway introduces the commercial website surface without changing the restaurant app into a full SaaS backend yet."
          />
          <div className="mx-auto mt-12 max-w-4xl divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {faqs.map((item) => (
              <article key={item.question} className="p-6">
                <h3 className="text-lg font-semibold text-secondary">{item.question}</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-700">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white py-10">
        <div className="site-container flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-secondary">RestaurantOps Gateway</p>
            <p className="mt-1 text-sm text-neutral-600">Business gateway foundation for restaurant automation.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/public" className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold">
              Demo Restaurant live demo
            </a>
            <a href="#request-demo" className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-white">
              Request customization
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
