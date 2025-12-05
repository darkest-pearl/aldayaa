'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';

export default function GalleryClient({ categories }) {
  const [active, setActive] = useState('all');
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const photos = useMemo(() => (
    active === 'all'
      ? categories.flatMap((c) => c.photos.map((p) => ({ ...p, category: c.name })))
      : categories
        .filter((c) => c.id === active)
        .flatMap((c) => c.photos.map((p) => ({ ...p, category: c.name })))
  ), [active, categories]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 md:gap-3 mb-5 md:mb-6">
        <button onClick={() => setActive('all')} className={`px-3 py-2 rounded-full text-sm md:text-base ${active === 'all' ? 'bg-primary text-white' : 'bg-white border'}`}>All</button>
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => setActive(cat.id)} className={`px-3 py-2 rounded-full text-sm md:text-base ${active === cat.id ? 'bg-primary text-white' : 'bg-white border'}`}>{cat.name}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {photos.map((photo) => (
          <motion.button
            key={photo.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative h-36 sm:h-44 rounded-2xl overflow-hidden shadow focus:outline-none focus:ring-2 focus:ring-primary"
            onClick={() => setSelectedPhoto(photo)}
          >
            <Image
              src={photo.imageUrl}
              alt={photo.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              loading="lazy"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-105 group-focus-visible:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex items-end">
              <div>
                <p className="text-white font-semibold text-sm">{photo.title}</p>
                <p className="text-white/80 text-xs">{photo.category}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                aria-label="Close image"
              >
                ×
              </button>
              <div className="relative w-full overflow-hidden rounded-3xl bg-black aspect-[4/3] sm:aspect-[16/10]">
                <Image
                  src={selectedPhoto.imageUrl}
                  alt={selectedPhoto.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 80vw"
                  className="object-contain"
                  priority
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}