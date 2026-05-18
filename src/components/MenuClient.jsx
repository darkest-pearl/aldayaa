'use client';
import { useState } from 'react';
import MenuItemImage from './MenuItemImage';

export default function MenuClient({ categories }) {
  const [active, setActive] = useState('all');
  const items =
    active === 'all'
      ? categories.flatMap((c) => c.items.map((item) => ({ ...item, category: c.name })))
      : categories
          .filter((c) => c.id === active)
          .flatMap((c) => c.items.map((item) => ({ ...item, category: c.name })));

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 sm:justify-center">
        <button
          onClick={() => setActive('all')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold shadow-soft transition duration-200 ease-gentle ${
            active === 'all'
              ? 'bg-primary text-secondary shadow-lifted'
              : 'bg-white/90 border border-neutral-200 text-neutral-800 hover:-translate-y-0.5 hover:shadow-soft'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActive(cat.id)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold shadow-soft transition duration-200 ease-gentle ${
              active === cat.id
                ? 'bg-primary text-secondary shadow-lifted'
                : 'bg-white/90 border border-neutral-200 text-neutral-800 hover:-translate-y-0.5 hover:shadow-soft'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="section-bg flex h-full flex-col justify-between rounded-2xl p-3 sm:p-4 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lifted"
          >
            <div className="space-y-3">
              <MenuItemImage
                src={item.imageUrl}
                alt={item.name}
                className="w-full"
              />
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-semibold text-base md:text-lg text-secondary">{item.name}</h3>
                  <p className="text-sm text-neutral-700 leading-relaxed">{item.description}</p>
                </div>
                <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-secondary">
                  AED {item.price.toFixed(2)}
                </span>
              </div>
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">{item.category}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.recommended && (
                <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                  Chef recommendation
                </span>
              )}
              {!item.isAvailable && (
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                  Currently unavailable
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}