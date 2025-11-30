'use client';
import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function GalleryClient({ categories }) {
  const [active, setActive] = useState('all');
  const photos = active === 'all'
    ? categories.flatMap((c) => c.photos.map((p) => ({ ...p, category: c.name })))
    : categories.filter((c) => c.id === active).flatMap((c) => c.photos.map((p) => ({ ...p, category: c.name })));

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => setActive('all')} className={`px-4 py-2 rounded-full ${active === 'all' ? 'bg-primary text-white' : 'bg-white border'}`}>All</button>
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => setActive(cat.id)} className={`px-4 py-2 rounded-full ${active === cat.id ? 'bg-primary text-white' : 'bg-white border'}`}>{cat.name}</button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {photos.map((photo) => (
          <motion.div key={photo.id} whileHover={{ scale: 1.02 }} className="relative h-44 rounded-xl overflow-hidden shadow">
            <Image src={photo.imageUrl} alt={photo.title} fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex items-end">
              <div>
                <p className="text-white font-semibold text-sm">{photo.title}</p>
                <p className="text-white/80 text-xs">{photo.category}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}