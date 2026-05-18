'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Section from '../../components/Section';
import Button from '../../components/Button';
import { strings } from '../../lib/strings';

const highlights = [
  {
    title: 'Mixed Grill Platter',
    desc: 'Charcoal-grilled goodness with signature spices.',
    image: '/images/food-grill.jpg',
  },
  {
    title: 'Colorful Mezze',
    desc: 'Homestyle hummus, mutabal, tabbouleh and more.',
    image: '/images/food-mezze.jpg',
  },
  {
    title: 'Spiced Biryani',
    desc: 'Aromatic rice layered with tender meats and saffron.',
    image: '/images/food-salads.jpg',
  },
];

const pillars = [
  {
    title: 'Authentic Recipes',
    desc: 'Syrian and Indian classics, crafted by chefs who grew up with these flavors.',
  },
  {
    title: 'Fresh Ingredients',
    desc: 'Daily produce and quality meats grilled over real flame.',
  },
  {
    title: 'Family Atmosphere',
    desc: 'Warm Levantine hospitality with cozy seating till late night.',
  },
];

const recommendedFallbackImage = '/images/food-mezze.jpg';
const slideIntervalMs = 4500;
const swipeConfidenceThreshold = 60;

const getItemsPerView = (width) => {
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 768) return 2;
  return 1;
};

const formatPrice = (price) => {
  if (typeof price === 'number' && !Number.isNaN(price)) {
    return `AED ${price.toFixed(2)}`;
  }
  return 'AED —';
};

export default function HomeClient({ recommendedDishes = [] }) {
  const hasRecommendedDishes = recommendedDishes.length > 0;
  const [itemsPerView, setItemsPerView] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const updateItemsPerView = () => {
      setItemsPerView(getItemsPerView(window.innerWidth));
    };

    updateItemsPerView();
    window.addEventListener('resize', updateItemsPerView);

    return () => window.removeEventListener('resize', updateItemsPerView);
  }, []);

  const effectiveItemsPerView = Math.max(
    1,
    Math.min(itemsPerView, recommendedDishes.length || 1)
  );

  const slideGroups = useMemo(() => {
    const groups = [];
    for (let i = 0; i < recommendedDishes.length; i += effectiveItemsPerView) {
      groups.push(recommendedDishes.slice(i, i + effectiveItemsPerView));
    }
    return groups;
  }, [recommendedDishes, effectiveItemsPerView]);

  useEffect(() => {
    if (currentIndex > slideGroups.length - 1) {
      setCurrentIndex(0);
    }
  }, [currentIndex, slideGroups.length]);

  const shouldAutoPlay = recommendedDishes.length >= 3 && slideGroups.length > 1;
  const shouldCenterItems =
    recommendedDishes.length > 0 && recommendedDishes.length < 3;

  useEffect(() => {
    if (!shouldAutoPlay || isPaused) return undefined;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slideGroups.length);
    }, slideIntervalMs);

    return () => clearInterval(timer);
  }, [isPaused, shouldAutoPlay, slideGroups.length]);

  const handleNext = () => {
    if (slideGroups.length < 2) return;
    setCurrentIndex((prev) => (prev + 1) % slideGroups.length);
  };

  const handlePrev = () => {
    if (slideGroups.length < 2) return;
    setCurrentIndex((prev) =>
      prev === 0 ? slideGroups.length - 1 : prev - 1
    );
  };

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[effectiveItemsPerView];

  return (
    <div className="bg-[#f6f0e7] text-textdark">
      {/* HERO */}
      <section className="relative overflow-hidden bg-neutral-950 text-white">
        <div className="absolute inset-0">
          <Image
            src="/images/hero-exterior.jpg"
            alt="Restaurant exterior"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/60 to-amber-900/30" />
        </div>

        <Section className="relative z-10 py-10 md:py-16 flex flex-col md:flex-row gap-8 md:gap-10 items-center">
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-xs md:text-sm tracking-wide">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>Modern Levantine Luxury</span>
            </div>

            <h1 className="text-2xl md:text-4xl lg:text-5xl font-semibold text-white/90 tracking-tight leading-tight font-serif">
              Authentic Levantine flavors, elevated
            </h1>

            <p className="text-sm md:text-base lg:text-lg leading-relaxed text-white/80 max-w-2xl mx-auto md:mx-0">
              Experience Al Dayaa Al Shamiah—where fire-grilled favorites, mezze, and biryani come together in a refined, warm atmosphere.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center md:justify-start">
              <Link href="/public/order">
                <Button className="bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-full px-6 py-3 shadow-lg hover:shadow-xl transition-all">
                  Order Online
                </Button>
              </Link>
              <Link href="/public/reservations">
                <Button className="border border-white/30 bg-white/10 hover:bg-white/20 text-white rounded-full px-6 py-3 backdrop-blur-sm transition-all">
                  Reserve a Table
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex-1 w-full">
            <div className="relative h-60 md:h-80 lg:h-96 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              <Image
                src="/images/food-mezze.jpg"
                alt="Signature mezze"
                fill
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/50 to-transparent" />
              <div className="absolute bottom-4 left-4 bg-white/90 text-neutral-900 px-4 py-2 rounded-full text-xs md:text-sm font-semibold shadow">
                Warmth, spice, and charcoal flame
              </div>
            </div>
          </div>
        </Section>
      </section>

      {/* HIGHLIGHTS */}
      <Section className="bg-[#f6f0e7]">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-lg md:text-3xl font-semibold tracking-tight text-neutral-900 font-serif">
            Why Guests Love Us
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-neutral-700 max-w-2xl mx-auto">
            Signature plates and heartfelt hospitality inspired by the Levant.
          </p>
        </div>

        <div className="grid gap-4 md:gap-6 md:grid-cols-3">
          {highlights.map((item) => (
            <motion.div
              key={item.title}
              whileHover={{ translateY: -4 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white/90 border border-amber-100 rounded-2xl p-4 md:p-5 shadow-sm backdrop-blur-sm transition-transform"
            >
              <div className="relative h-36 md:h-40 mb-4 overflow-hidden rounded-xl">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 33vw, 400px"
                  loading="lazy"
                  className="object-cover"
                />
              </div>
              <h3 className="font-semibold text-base md:text-lg text-neutral-900">
                {item.title}
              </h3>
              <p className="text-sm md:text-base leading-relaxed text-neutral-700 mb-3">
                {item.desc}
              </p>
              <Link
                href="/public/menu"
                className="text-amber-700 font-semibold hover:text-amber-600 transition-colors text-sm"
              >
                View Menu →
              </Link>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* PILLARS */}
      <Section className="bg-white">
        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          {pillars.map((pillar) => (
            <motion.div
              key={pillar.title}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="p-4 md:p-5 bg-amber-50/60 border border-amber-100 rounded-2xl shadow-sm"
            >
              <h3 className="font-semibold text-base md:text-xl mb-2 text-neutral-900 font-serif">
                {pillar.title}
              </h3>
              <p className="text-sm md:text-base leading-relaxed text-neutral-700">
                {pillar.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* SIGNATURE DISHES (DARK SECTION) */}
      {hasRecommendedDishes && (
        <section className="bg-neutral-950 text-white">
          <Section className="py-10 md:py-16">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
              <div>
                <p className="uppercase tracking-[0.2em] text-amber-400 text-xs mb-2">
                  Recommended Dishes
                </p>
                <h3 className="text-xl md:text-3xl font-semibold tracking-tight font-serif">
                  A taste of the menu
                </h3>
                <p className="text-sm md:text-base text-white/70 mt-2 max-w-xl">
                  Crafted with tradition and served with a modern touch. Explore a few favorites before you dive into the full selection.
                </p>
              </div>
              <Link href="/public/menu">
                <Button className="bg-white text-neutral-950 rounded-full px-5 py-3 shadow-md hover:-translate-y-0.5 transition-all">
                  View Full Menu
                </Button>
              </Link>
            </div>

            <div
              className="relative"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <motion.div
                drag={slideGroups.length > 1 ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={(_event, info) => {
                  if (info.offset.x < -swipeConfidenceThreshold) {
                    handleNext();
                  }
                  if (info.offset.x > swipeConfidenceThreshold) {
                    handlePrev();
                  }
                }}
                animate={{ x: `-${currentIndex * 100}%` }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                className="flex"
              >
                {slideGroups.map((group, groupIndex) => (
                  <div key={`slide-${groupIndex}`} className="min-w-full">
                    <div
                      className={[
                        shouldCenterItems ? 'mx-auto max-w-4xl' : '',
                        shouldCenterItems ? 'justify-items-center' : '',
                        shouldCenterItems
                          ? `grid gap-4 md:gap-6 ${gridColsClass}`
                          : `grid gap-4 md:gap-6 ${gridColsClass}`,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {group.map((dish) => (
                        <motion.div
                          key={dish.id}
                          whileHover={{ translateY: -4 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 shadow-sm"
                        >
                          <div className="relative mb-3 h-28 rounded-xl overflow-hidden border border-white/10">
                            <Image
                              src={dish.imageUrl || recommendedFallbackImage}
                              alt={dish.name}
                              fill
                              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 320px"
                              className="object-cover"
                            />
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-base md:text-lg font-semibold tracking-tight font-serif">
                              {dish.name}
                            </h4>
                            <span className="text-amber-300 text-xs md:text-sm font-semibold">
                              {formatPrice(dish.price)}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed text-white/70">
                            {dish.description ||
                              'Guest-favorite selection from our recommended list.'}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  ))}
              </motion.div>

              {slideGroups.length > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  {slideGroups.map((_group, index) => (
                    <button
                      key={`dot-${index}`}
                      type="button"
                      aria-label={`Go to slide ${index + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        index === currentIndex
                          ? 'w-6 bg-amber-400'
                          : 'w-2 bg-white/30 hover:bg-white/60'
                      }`}
                      onClick={() => setCurrentIndex(index)}
                    />
                  ))}
                </div>
              )}
            </div>

            <noscript>
              <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-4 mt-6">
                {recommendedDishes.map((dish) => (
                  <div
                    key={dish.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 shadow-sm"
                  >
                    <div className="relative mb-3 h-28 rounded-xl overflow-hidden border border-white/10">
                      <Image
                        src={dish.imageUrl || recommendedFallbackImage}
                        alt={dish.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 320px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-base md:text-lg font-semibold tracking-tight font-serif">
                        {dish.name}
                      </h4>
                      <span className="text-amber-300 text-xs md:text-sm font-semibold">
                        {formatPrice(dish.price)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-white/70">
                      {dish.description ||
                        'Guest-favorite selection from our recommended list.'}
                    </p>
                  </div>
                ))}
              </div>
            </noscript>
          </Section>
        </section>
      )}

      {/* STORY SECTION */}
      <Section className="bg-[#f6f0e7]">
        <div className="flex flex-col md:grid md:grid-cols-[1.2fr,1fr] gap-5 md:gap-8 items-center">
          <div className="space-y-3">
            <h3 className="text-lg md:text-3xl font-semibold font-serif text-neutral-900">
              Our Story, Served Warm
            </h3>
            <p className="text-sm md:text-base leading-relaxed text-neutral-700">
              We bring the warmth of Levantine hospitality with a menu spanning shawarma, grills, biryani, mezze, and fresh juices. Late-night diners and families alike gather here for flame-kissed meats and vibrant flavors.
            </p>
            <Link
              href="/public/about"
              className="text-amber-700 font-semibold hover:text-amber-600 transition-colors text-sm md:text-base"
            >
              Read our story →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4 w-full">
            <div className="relative h-28 md:h-40 lg:h-48">
              <Image
                src="/images/interior-1.jpg"
                alt="Interior"
                fill
                sizes="(max-width: 768px) 48vw, 280px"
                loading="lazy"
                className="rounded-xl object-cover shadow-md"
              />
            </div>
            <div className="relative h-28 md:h-40 lg:h-48">
              <Image
                src="/images/food-drinks.jpg"
                alt="Drinks"
                fill
                sizes="(max-width: 768px) 48vw, 280px"
                loading="lazy"
                className="rounded-xl object-cover shadow-md"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* CTA STRIP */}
      <Section className="bg-white">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-amber-50/80 border border-amber-100 rounded-2xl px-4 py-5 md:px-8 md:py-8 shadow-sm">
          <div>
            <p className="text-base md:text-xl font-semibold text-neutral-900">
              Ready to enjoy?
            </p>
            <p className="text-sm md:text-base text-neutral-700">
              Order for delivery or book your table in a few taps.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link href="/public/order" className="w-full sm:w-auto">
              <Button className="bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-full w-full px-5 py-3 shadow-md hover:shadow-lg transition-all">
                Order for Delivery or Pickup
              </Button>
            </Link>
            <Link href="/public/reservations" className="w-full sm:w-auto">
              <Button className="border border-amber-300 bg-white text-neutral-900 hover:bg-amber-100 rounded-full w-full px-5 py-3 transition-all">
                Reserve a Table
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      {/* FOOTER STRIP */}
      <div className="bg-neutral-900 text-white py-6">
        <Section className="py-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-base md:text-lg">Open late every day</p>
              <p className="text-xs md:text-sm text-white/80">
                {strings.hours.weekday} | {strings.hours.friday}
              </p>
            </div>
            <Link
              href={strings.whatsappLink}
              target="_blank"
              className="bg-amber-500 text-neutral-900 px-4 py-2 rounded-full shadow hover:-translate-y-0.5 transition-transform text-sm md:text-base"
            >
              WhatsApp {strings.whatsapp}
            </Link>
          </div>
        </Section>
      </div>
    </div>
  );
}