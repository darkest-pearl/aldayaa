import { prisma } from './prisma';
import { getDefaultEnabledFeatures, normalizeEnabledFeatures } from './features';
import { strings } from './strings';

export const defaultRestaurantProfile = {
  id: 1,
  restaurantName: strings.restaurantName,
  tagline: strings.tagline,
  cuisineType: 'Arabic & Indian',
  whatsappNumber: strings.whatsapp,
  whatsappLink: strings.whatsappLink,
  address: strings.address,
  googleMapsUrl: strings.googleMaps,
  googleMapsEmbedUrl: strings.googleMapsEmbed,
  instagramUrl: 'https://www.instagram.com/aldayaa.rest/?hl=en',
  facebookUrl: 'https://www.facebook.com/aldayaaalshamiah/',
  tiktokUrl: 'https://www.tiktok.com/@aldayaa_alshamiah',
  linktreeUrl: strings.linktree,
  logoUrl: '/images/logo-al-dayaa.png',
  primaryColor: '#d6b15f',
  secondaryColor: '#183b32',
  currency: 'AED',
  enabledFeatures: getDefaultEnabledFeatures(),
};

const profileStringFields = [
  'restaurantName',
  'tagline',
  'cuisineType',
  'whatsappNumber',
  'whatsappLink',
  'address',
  'googleMapsUrl',
  'googleMapsEmbedUrl',
  'instagramUrl',
  'facebookUrl',
  'tiktokUrl',
  'linktreeUrl',
  'logoUrl',
  'primaryColor',
  'secondaryColor',
  'currency',
];

function pickString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function normalizeRestaurantProfile(profile = {}) {
  const normalized = { ...defaultRestaurantProfile };

  for (const field of profileStringFields) {
    normalized[field] = pickString(profile[field], defaultRestaurantProfile[field]);
  }

  normalized.id = profile.id || defaultRestaurantProfile.id;
  normalized.enabledFeatures = normalizeEnabledFeatures(profile.enabledFeatures);
  normalized.createdAt = profile.createdAt;
  normalized.updatedAt = profile.updatedAt;

  return normalized;
}

export function toPublicRestaurantProfile(profile = {}) {
  const normalized = normalizeRestaurantProfile(profile);
  const publicProfile = profileStringFields.reduce(
    (publicProfile, field) => ({
      ...publicProfile,
      [field]: normalized[field],
    }),
    { id: normalized.id },
  );

  return {
    ...publicProfile,
    enabledFeatures: normalized.enabledFeatures,
  };
}

export function toPrismaRestaurantProfileData(profile = {}) {
  const normalized = normalizeRestaurantProfile(profile);
  return {
    ...profileStringFields.reduce(
      (data, field) => ({
        ...data,
        [field]: normalized[field],
      }),
      {},
    ),
    enabledFeatures: JSON.stringify(normalized.enabledFeatures),
  };
}

export async function getRestaurantProfile() {
  if (!process.env.DATABASE_URL) {
    return normalizeRestaurantProfile();
  }

  try {
    const profile = await prisma.restaurantProfile.upsert({
      where: { id: 1 },
      update: {},
      create: toPrismaRestaurantProfileData(defaultRestaurantProfile),
    });

    return normalizeRestaurantProfile(profile);
  } catch (error) {
    console.error('Failed to load restaurant profile', error);
    return normalizeRestaurantProfile();
  }
}
