import Image from 'next/image';
import Section from '../../../components/Section';

export const metadata = { title: 'About | Al Dayaa Al Shamiah' };

export default function AboutPage() {
  return (
    <Section>
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h1 className="text-3xl font-semibold mb-4">Our Story</h1>
          <p className="text-textdark/80 mb-3">Al Dayaa Al Shamiah Restaurant was created to share the soul of Levantine street food and the warmth of family dining in Sharjah. From shawarma carved off the spit to sizzling grills and fragrant biryanis, every dish is prepared with time-honored techniques.</p>
          <p className="text-textdark/80 mb-3">We welcome late-night cravings, celebrations, and casual gatherings alike. The menu blends Syrian and Indian influences, celebrating charcoal, spice, and generous hospitality.</p>
          <p className="text-textdark/80">Our team continually refreshes specials and seasonal juices, ensuring each visit feels vibrant and comforting.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="relative h-40 md:h-48">
            <Image src="/images/interior-2.jpg" alt="Dining room" fill className="rounded-xl object-cover" />
          </div>
          <div className="relative h-40 md:h-48">
            <Image src="/images/vibes-family.jpg" alt="Guests" fill className="rounded-xl object-cover" />
          </div>
          <div className="relative h-40 md:h-48">
            <Image src="/images/food-desserts.jpg" alt="Desserts" fill className="rounded-xl object-cover" />
          </div>
          <div className="relative h-40 md:h-48">
            <Image src="/images/vibes-night.jpg" alt="Night vibe" fill className="rounded-xl object-cover" />
          </div>
        </div>
      </div>
    </Section>
  );
}