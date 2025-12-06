import { prisma } from "./prisma";

/** Ordered list of valid week days for working hours. */
export const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * Construct default working hours across all days.
 * @param {string} [openingTime="08:00"] - Standard opening time.
 * @param {string} [closingTime="23:00"] - Standard closing time.
 * @returns {{ day: string; openingTime: string; closingTime: string; closed: boolean }[]} Normalized daily hours.
 */
export function createDefaultWorkingHours(openingTime = "08:00", closingTime = "23:00") {
  return DAYS_OF_WEEK.map((day) => ({ day, openingTime, closingTime, closed: false }));
}

/**
 * Build default display hours object used in marketing copy.
 * @param {string} [openingTime="08:00"] - Opening time string.
 * @param {string} [closingTime="23:00"] - Closing time string.
 * @returns {{ weekday: string; friday: string; saturday: string }} Display-ready hours.
 */
function createDefaultDisplayHours(openingTime = "08:00", closingTime = "23:00") {
  const range = `${openingTime} – ${closingTime}`;
  return {
    weekday: `Sunday–Thursday: ${range}`,
    friday: `Friday: ${range}`,
    saturday: `Saturday: ${range}`,
  };
}

/**
 * Normalize working hours input to ensure every day is present with fallbacks.
 * @param {string | Array<{ day: string; openingTime?: string; closingTime?: string; closed?: boolean }>} workingHoursByDay - Raw working hours.
 * @param {string} fallbackOpeningTime - Default opening time.
 * @param {string} fallbackClosingTime - Default closing time.
 * @returns {{ day: string; openingTime: string; closingTime: string; closed: boolean }[]} Normalized hours by day.
 */
export function normalizeWorkingHoursByDay(workingHoursByDay, fallbackOpeningTime, fallbackClosingTime) {
  const defaults = createDefaultWorkingHours(fallbackOpeningTime, fallbackClosingTime);
  const parsedWorkingHours = (() => {
    if (Array.isArray(workingHoursByDay)) return workingHoursByDay;
    if (typeof workingHoursByDay === "string") {
      try {
        const parsed = JSON.parse(workingHoursByDay);
        if (Array.isArray(parsed)) return parsed;
      } catch (error) {
        console.warn("Unable to parse working hours JSON", error);
      }
    }
    return [];
  })();

  const providedMap = new Map(parsedWorkingHours.map((entry) => [entry.day, entry]));

  return defaults.map((dayDefaults) => {
    const found = providedMap.get(dayDefaults.day) || {};
    return {
      day: dayDefaults.day,
      openingTime: found.openingTime || dayDefaults.openingTime,
      closingTime: found.closingTime || dayDefaults.closingTime,
      closed: Boolean(found.closed),
    };
  });
}

const defaultSettings = {
  id: 1,
  openingTime: "08:00",
  closingTime: "23:00",
  allowCancelPaid: false,
  allowCancelInProgress: false,
  cancellationFee: 0,
  workingHoursByDay: createDefaultWorkingHours(),
  displayHours: createDefaultDisplayHours(),
};

function parseDisplayHours(displayHours, openingTime, closingTime) {
  const defaults = createDefaultDisplayHours(openingTime, closingTime);
  const provided = (() => {
    if (!displayHours) return {};
    if (typeof displayHours === "string") {
      try {
        const parsed = JSON.parse(displayHours);
        if (parsed && typeof parsed === "object") return parsed;
      } catch (error) {
        console.warn("Unable to parse display hours JSON", error);
        return {};
      }
    }

    if (typeof displayHours === "object") return displayHours;
    return {};
  })();

  return {
    weekday: provided.weekday || defaults.weekday,
    friday: provided.friday || defaults.friday,
    saturday: provided.saturday || defaults.saturday,
  };
}

/**
 * Retrieve restaurant settings with persistence for missing defaults.
 * @returns {Promise<{ id: number; openingTime: string; closingTime: string; allowCancelPaid: boolean; allowCancelInProgress: boolean; cancellationFee: number; workingHoursByDay: Array<{day: string; openingTime: string; closingTime: string; closed: boolean}>; displayHours: {weekday: string; friday: string; saturday: string} }>} Normalized settings.
 */
export async function getRestaurantSettings() {
  try {
    const settings = await prisma.restaurantSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        ...defaultSettings,
        workingHoursByDay: JSON.stringify(defaultSettings.workingHoursByDay),
        displayHours: JSON.stringify(defaultSettings.displayHours),
      },
    });

  const workingHoursByDay = normalizeWorkingHoursByDay(
      settings.workingHoursByDay,
      settings.openingTime || defaultSettings.openingTime,
      settings.closingTime || defaultSettings.closingTime,
    );

    const displayHours = parseDisplayHours(
      settings.displayHours,
      settings.openingTime || defaultSettings.openingTime,
      settings.closingTime || defaultSettings.closingTime,
    );

    const serializedWorkingHours = JSON.stringify(workingHoursByDay);
    const shouldPersistWorkingHours = settings.workingHoursByDay !== serializedWorkingHours;

    const serializedDisplayHours = JSON.stringify(displayHours);
    const shouldPersistDisplayHours = serializedDisplayHours !== JSON.stringify(settings.displayHours);

    if (shouldPersistWorkingHours) {
      await prisma.restaurantSettings.update({
        where: { id: settings.id },
        data: { workingHoursByDay: serializedWorkingHours },
      });
    }

    if (shouldPersistDisplayHours) {
      await prisma.restaurantSettings.update({
        where: { id: settings.id },
        data: { displayHours: serializedDisplayHours },
      });
    }

    return { ...settings, workingHoursByDay, displayHours };
  } catch (error) {
    console.error("Failed to load restaurant settings", error);
    throw error;
  }
}

/**
 * Safely parse display hours from persisted settings.
 * @param {{ displayHours: string | object; openingTime: string; closingTime: string }} settings - Stored settings payload.
 * @returns {{ weekday: string; friday: string; saturday: string }} Normalized display hours.
 */
export function getDisplayHours(settings) {
  if (!settings) {
    return createDefaultDisplayHours();
  }
  return parseDisplayHours(settings.displayHours, settings.openingTime, settings.closingTime);
}