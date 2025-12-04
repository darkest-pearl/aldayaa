'use client';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Section from '../../components/Section';
import Button from '../../components/Button';
import { strings } from '../../lib/strings';

const highlights = [
  { title: 'Mixed Grill Platter', desc: 'Charcoal-grilled goodness with signature spices.', image: '/images/food-grill.jpg' },
  { title: 'Colorful Mezze', desc: 'Homestyle hummus, mutabal, tabbouleh and more.', image: '/images/food-mezze.jpg' },
  { title: 'Spiced Biryani', desc: 'Aromatic rice layered with tender meats and saffron.', image: '/images/food-salads.jpg' }
];

const pillars = [
  { title: 'Authentic Recipes', desc: 'Syrian and Indian classics, crafted by chefs who grew up with these flavors.' },
  { title: 'Fresh Ingredients', desc: 'Daily produce and quality meats grilled over real flame.' },
  { title: 'Family Atmosphere', desc: 'Warm Levantine hospitality with cozy seating till late night.' }
];

export default function HomePage() {
  return (
    <div>
      <section className="relative h-[70vh] flex items-center justify-center overflow-hidden">
        <Image
          src="/images/hero-exterior.jpg"
          alt="Restaurant exterior"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-primary/30" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center text-white px-4"
        >
          <div className="flex items-center justify-center mb-4">
            <Image
              src="/images/logo-al-dayaa.png"
              alt="Logo"
              width={96}
              height={96}
              priority
              className="rounded-full shadow-lg"
            />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-3">{strings.restaurantName}</h1>
          <p className="text-lg md:text-2xl max-w-2xl mx-auto mb-6">{strings.tagline}</p>
          <div className="flex justify-center gap-4">
            <Link href="/public/reservations"><Button>Reserve a Table</Button></Link>
            <Link href="/public/order"><Button className="bg-secondary">Order Online</Button></Link>
          </div>
        </motion.div>
      </section>

      <Section>
        <div className="text-center mb-10">
          <h2 className="text-xl md:text-2xl font-semibold">Our Highlights</h2>
          <p className="text-base leading-relaxed text-textdark/70">Signature plates guests love.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {highlights.map((item) => (
            <motion.div key={item.title} whileHover={{ translateY: -6 }} className="section-bg p-4">
              <div className="relative h-40 mb-3 overflow-hidden rounded-xl">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 33vw, 400px"
                  loading="lazy"
                  className="object-cover"
                />
              </div>
              <h3 className="font-semibold text-lg">{item.title}</h3>
              <p className="text-base leading-relaxed text-textdark/70 mb-3">{item.desc}</p>
              <Link href="/public/menu" className="text-primary font-semibold">View Menu →</Link>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section className="section-bg">
        <div className="grid md:grid-cols-3 gap-6">
          {pillars.map((pillar) => (
            <motion.div key={pillar.title} whileHover={{ scale: 1.02 }} className="p-4">
              <h3 className="font-semibold text-xl mb-2">{pillar.title}</h3>
              <p className="text-textdark/70">{pillar.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-xl md:text-2xl font-semibold mb-3">About Al Dayaa Al Shamiah</h3>
            <p className="text-base leading-relaxed text-textdark/80 mb-4">We bring the warmth of Levantine hospitality with a menu spanning shawarma, grills, biryani, mezze, and fresh juices. Late-night diners and families alike gather here for flame-kissed meats and vibrant flavors.</p>
            <Link href="/public/about" className="text-primary font-semibold">Read our story →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative h-32 md:h-40">
              <Image
                src="/images/interior-1.jpg"
                alt="Interior"
                fill
                sizes="(max-width: 768px) 48vw, 280px"
                loading="lazy"
                className="rounded-xl object-cover"
              />
            </div>
            <div className="relative h-32 md:h-40">
              <Image
                src="/images/food-drinks.jpg"
                alt="Drinks"
                fill
                sizes="(max-width: 768px) 48vw, 280px"
                loading="lazy"
                className="rounded-xl object-cover"
              />
            </div>
          </div>
        </div>
      </Section>

      <div className="bg-primary text-white py-6">
        <Section className="py-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Open late every day</p>
              <p className="text-sm">{strings.hours.weekday} | {strings.hours.friday}</p>
            </div>
            <Link href={strings.whatsappLink} target="_blank" className="bg-white text-primary px-4 py-2 rounded-full shadow hover:scale-105 transition-transform">
              WhatsApp {strings.whatsapp}
            </Link>
          </div>
        </Section>
      </div>
    </div>
  );
}