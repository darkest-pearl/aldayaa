'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function MenuClient({ categories }) {
  const [active, setActive] = useState('all');
  const items = active === 'all'
    ? categories.flatMap((c) => c.items.map((item) => ({ ...item, category: c.name })))
    : categories
        .filter((c) => c.id === active)
        .flatMap((c) => c.items.map((item) => ({ ...item, category: c.name })));

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => setActive('all')} className={`px-4 py-2 rounded-full ${active === 'all' ? 'bg-primary text-white' : 'bg-white border'}`}>
          All
        </button>
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => setActive(cat.id)} className={`px-4 py-2 rounded-full ${active === cat.id ? 'bg-primary text-white' : 'bg-white border'}`}>
            {cat.name}
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((item) => (
          <motion.div key={item.id} whileHover={{ translateY: -4 }} className="section-bg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{item.name}</h3>
                <p className="text-sm text-textdark/70">{item.description}</p>
                <p className="text-xs text-secondary">{item.category}</p>
              </div>
              <div className="font-semibold text-primary">AED {item.price.toFixed(2)}</div>
            </div>
            {!item.isAvailable && <p className="text-xs text-red-600 mt-2">Currently unavailable</p>}
            {item.recommended && <span className="text-xs bg-secondary/20 text-secondary px-2 py-1 rounded-full mt-2 inline-block">Chef recommendation</span>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}