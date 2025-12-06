/**
 * Generate a predictable, timestamp-based reference string.
 * Format: AD-YYMMDDHHmmss-msssRRRR
 * @returns {string} Unique reference identifier.
 */
export function generateReference() {
  const now = new Date();

  /**
   * Pad a number to a fixed width with leading zeros.
   * @param {number} num - Number to pad.
   * @param {number} size - Desired width.
   * @returns {string} Padded number string.
   */
  const pad = (num, size) => num.toString().padStart(size, "0");

  const YY = now.getFullYear().toString().slice(-2);
  const MM = pad(now.getMonth() + 1, 2);
  const DD = pad(now.getDate(), 2);

  const HH = pad(now.getHours(), 2);
  const mm = pad(now.getMinutes(), 2);
  const ss = pad(now.getSeconds(), 2);

  const ms = pad(now.getMilliseconds(), 3);
  const rand = Math.floor(1000 + Math.random() * 9000); // 4-digit random

  return `AD-${YY}${MM}${DD}${HH}${mm}${ss}-${ms}${rand}`;
}
