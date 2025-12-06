import { prisma } from './prisma';

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export function createDefaultWorkingHours(openingTime = '08:00', closingTime = '23:00') {
  return DAYS_OF_WEEK.map((day) => ({ day, openingTime, closingTime, closed: false }));
}

function createDefaultDisplayHours(openingTime = '08:00', closingTime = '23:00') {
  const range = `${openingTime} – ${closingTime}`;
  return {
    weekday: `Sunday–Thursday: ${range}`,
    friday: `Friday: ${range}`,
    saturday: `Saturday: ${range}`,
  };
}

export function normalizeWorkingHoursByDay(workingHoursByDay, fallbackOpeningTime, fallbackClosingTime) {
  const defaults = createDefaultWorkingHours(fallbackOpeningTime, fallbackClosingTime);
  const parsedWorkingHours = (() => {
    if (Array.isArray(workingHoursByDay)) return workingHoursByDay;
    if (typeof workingHoursByDay === 'string') {
      try {
        const parsed = JSON.parse(workingHoursByDay);
        if (Array.isArray(parsed)) return parsed;
      } catch (error) {
        // ignore malformed JSON
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
  openingTime: '08:00',
  closingTime: '23:00',
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
    if (typeof displayHours === 'string') {
      try {
        const parsed = JSON.parse(displayHours);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (error) {
        return {};
      }
    }

    if (typeof displayHours === 'object') return displayHours;
    return {};
  })();

  return {
    weekday: provided.weekday || defaults.weekday,
    friday: provided.friday || defaults.friday,
    saturday: provided.saturday || defaults.saturday,
  };
}

export async function getRestaurantSettings() {
  const settings = await prisma.restaurantSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      ...defaultSettings,
      workingHoursByDay: JSON.stringify(defaultSettings.workingHoursByDay),
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
      data: { displayHours },
    });
  }

  return { ...settings, workingHoursByDay, displayHours };
}

export function getDisplayHours(settings) {
  return parseDisplayHours(settings.displayHours, settings.openingTime, settings.closingTime);
}