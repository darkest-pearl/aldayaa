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

let cachedRestaurantProfile = null;
let pendingProfileLoad = null;
let pendingDefaultProfileCreate = null;

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

export function setRestaurantProfileCache(profile = {}) {
  cachedRestaurantProfile = normalizeRestaurantProfile(profile);
  return cachedRestaurantProfile;
}

export function clearRestaurantProfileCache() {
  cachedRestaurantProfile = null;
  pendingProfileLoad = null;
  pendingDefaultProfileCreate = null;
}

async function createDefaultRestaurantProfile() {
  try {
    const profile = await prisma.restaurantProfile.create({
      data: toPrismaRestaurantProfileData(defaultRestaurantProfile),
    });

    return setRestaurantProfileCache(profile);
  } catch (error) {
    if (error?.code === 'P2002') {
      const profile = await prisma.restaurantProfile.findUnique({
        where: { id: defaultRestaurantProfile.id },
      });

      if (profile) {
        return setRestaurantProfileCache(profile);
      }
    }

    throw error;
  }
}

export async function ensureRestaurantProfile() {
  if (!process.env.DATABASE_URL) {
    return normalizeRestaurantProfile();
  }

  if (cachedRestaurantProfile) {
    return cachedRestaurantProfile;
  }

  if (!pendingDefaultProfileCreate) {
    pendingDefaultProfileCreate = createDefaultRestaurantProfile().finally(() => {
      pendingDefaultProfileCreate = null;
    });
  }

  return pendingDefaultProfileCreate;
}

async function loadRestaurantProfileFromDatabase({ ensureExists }) {
  const profile = await prisma.restaurantProfile.findUnique({
    where: { id: defaultRestaurantProfile.id },
  });

  if (profile) {
    return setRestaurantProfileCache(profile);
  }

  if (ensureExists) {
    return await ensureRestaurantProfile();
  }

  return normalizeRestaurantProfile();
}

export async function getRestaurantProfile({ fallbackOnError = true, ensureExists = true } = {}) {
  if (!process.env.DATABASE_URL) {
    return normalizeRestaurantProfile();
  }

  if (cachedRestaurantProfile) {
    return cachedRestaurantProfile;
  }

  try {
    if (!pendingProfileLoad) {
      pendingProfileLoad = loadRestaurantProfileFromDatabase({ ensureExists }).finally(() => {
        pendingProfileLoad = null;
      });
    }

    return await pendingProfileLoad;
  } catch (error) {
    if (!fallbackOnError) {
      throw error;
    }

    console.error('Failed to load restaurant profile', error);
    return normalizeRestaurantProfile();
  }
}
