CREATE TABLE "RestaurantProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "restaurantName" TEXT NOT NULL DEFAULT 'Al Dayaa Al Shamiah Restaurant',
    "tagline" TEXT NOT NULL DEFAULT 'Authentic Arabic & Indian flavors in the heart of Sharjah.',
    "cuisineType" TEXT NOT NULL DEFAULT 'Arabic & Indian',
    "whatsappNumber" TEXT NOT NULL DEFAULT '+971 55 417 3293',
    "whatsappLink" TEXT NOT NULL DEFAULT 'https://wa.me/971554173293',
    "address" TEXT NOT NULL DEFAULT 'Al Dayaa Al Shamiah Restaurant',
    "googleMapsUrl" TEXT NOT NULL DEFAULT 'https://maps.app.goo.gl/n8Ced5MciXtpQCXCA',
    "googleMapsEmbedUrl" TEXT NOT NULL DEFAULT 'https://www.google.com/maps?output=embed&q=Al%20Dayaa%20Al%20Shamiah%20Restaurant%20Sharjah',
    "instagramUrl" TEXT NOT NULL DEFAULT 'https://www.instagram.com/aldayaa.rest/?hl=en',
    "facebookUrl" TEXT NOT NULL DEFAULT 'https://www.facebook.com/aldayaaalshamiah/',
    "tiktokUrl" TEXT NOT NULL DEFAULT 'https://www.tiktok.com/@aldayaa_alshamiah',
    "linktreeUrl" TEXT NOT NULL DEFAULT 'https://linktr.ee/aldaya',
    "logoUrl" TEXT NOT NULL DEFAULT '/images/logo-al-dayaa.png',
    "primaryColor" TEXT NOT NULL DEFAULT '#d6b15f',
    "secondaryColor" TEXT NOT NULL DEFAULT '#183b32',
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantProfile_pkey" PRIMARY KEY ("id")
);
