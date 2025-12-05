'use client';

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

const signatureDishes = [
  {
    title: 'Lamb Kabsa',
    desc: 'Slow-cooked basmati rice with fragrant spices and tender lamb.',
    price: '$17.50',
  },
  {
    title: 'Shish Tawook',
    desc: 'Chargrilled chicken skewers finished with garlic toum and pickles.',
    price: '$14.00',
  },
  {
    title: 'Royal Mezze',
    desc: 'Hummus, mutabal, fattoush, and warm bread for sharing.',
    price: '$12.00',
  },
  {
    title: 'Mandi with Raita',
    desc: 'Smoky, spiced rice crowned with your choice of juicy meat.',
    price: '$16.00',
  },
];

export default function HomePage() {
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

            <h1 className="text-2xl md:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight font-serif">
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
      <section className="bg-neutral-950 text-white">
        <Section className="py-10 md:py-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <p className="uppercase tracking-[0.2em] text-amber-400 text-xs mb-2">
                Signature Dishes
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

          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-4">
            {signatureDishes.map((dish) => (
              <motion.div
                key={dish.title}
                whileHover={{ translateY: -4 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base md:text-lg font-semibold tracking-tight font-serif">
                    {dish.title}
                  </h4>
                  <span className="text-amber-300 text-xs md:text-sm font-semibold">
                    {dish.price}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-white/70">{dish.desc}</p>
              </motion.div>
            ))}
          </div>
        </Section>
      </section>

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
