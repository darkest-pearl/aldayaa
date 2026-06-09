export const RESERVATION_STATUSES = Object.freeze(['PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW']);

export const RESERVATION_STATUS_LABELS = Object.freeze({
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
});

const RESTAURANT_TIME_ZONE = 'Asia/Dubai';

export function getReservationStatusLabel(status) {
  return RESERVATION_STATUS_LABELS[status] || status || 'Unknown';
}

export function isValidReservationStatus(status) {
  return RESERVATION_STATUSES.includes(status);
}

export function formatReservationDateOnly(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: RESTAURANT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const getPart = (type) => parts.find((part) => part.type === type)?.value;
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');

  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function normalizeReservation(reservation = {}) {
  return {
    id: reservation.id,
    reference: reservation.reference,
    name: reservation.name,
    phone: reservation.phone,
    email: reservation.email || '',
    date: formatReservationDateOnly(reservation.date),
    time: reservation.time,
    guests: reservation.guests,
    specialRequests: reservation.specialRequests || '',
    status: reservation.status,
    statusLabel: getReservationStatusLabel(reservation.status),
    createdAt: reservation.createdAt?.toISOString?.() || reservation.createdAt || null,
  };
}

export function normalizeReservations(reservations = []) {
  return reservations.map((reservation) => normalizeReservation(reservation));
}
