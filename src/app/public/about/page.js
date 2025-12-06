import Image from 'next/image';
import Section from '../../../components/Section';

export const metadata = { title: 'About | Al Dayaa Al Shamiah' };

export default function AboutPage() {
  return (
    <Section className="space-y-10">
      <div className="grid items-center gap-6 md:gap-10 md:grid-cols-[1.1fr,1fr]">
        <div className="section-bg p-6 md:p-8 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-secondary">
            Crafted with heritage
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-secondary">Our Story</h1>
          <p className="text-sm md:text-base leading-relaxed text-neutral-700">
            Al Dayaa Al Shamiah Restaurant was created to share the soul of Levantine street food and the warmth of family dining in Sharjah. From shawarma carved off the spit to sizzling grills and fragrant biryanis, every dish is prepared with time-honored techniques.
          </p>
          <p className="text-sm md:text-base leading-relaxed text-neutral-700">
            We welcome late-night cravings, celebrations, and casual gatherings alike. The menu blends Syrian and Indian influences, celebrating charcoal, spice, and generous hospitality.
          </p>
          <p className="text-sm md:text-base leading-relaxed text-neutral-700">
            Our team continually refreshes specials and seasonal juices, ensuring each visit feels vibrant and comforting.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {["/images/interior-2.jpg", "/images/vibes-family.jpg", "/images/food-desserts.jpg", "/images/vibes-night.jpg"].map((src, idx) => (
            <div key={src} className="relative h-36 sm:h-40 md:h-44 lg:h-48 overflow-hidden rounded-[18px] border border-white/60 shadow-soft bg-white/60">
              <Image
                src={src}
                alt="Restaurant visual"
                fill
                sizes="(max-width: 768px) 48vw, 300px"
                loading="lazy"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}