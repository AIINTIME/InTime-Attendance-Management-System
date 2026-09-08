const { getLocalDayOfWeek, getLocalParts } = require("./timezone");

/**
 * Employee weekly authentication rule (spec section 14):
 *  - Refresh tokens stay valid Monday through Saturday of the same week.
 *  - Sunday is a non-working reset day: no refresh-token week is valid.
 *  - Every Monday a fresh login is required.
 *
 * We identify a "week" by the calendar date (YYYY-MM-DD) of that week's
 * Monday, computed in the organization's timezone. This value is embedded
 * in the refresh token at login time and re-derived on every refresh
 * attempt; a mismatch (or a refresh attempted on Sunday) forces re-login.
 */
function getMondayKeyFor(date) {
  const { year, month, day } = getLocalParts(date);
  // Use UTC noon anchored on the local Y/M/D to avoid DST/timezone edge
  // shifting the date when we subtract days.
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = getLocalDayOfWeek(date); // 0 Sun .. 6 Sat

  // Distance back to Monday: Sunday(0) has no valid week of its own, but we
  // still compute "the Monday that just ended" only for reference; callers
  // must treat Sunday as always-expired via isWithinAuthWeek below.
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  anchor.setUTCDate(anchor.getUTCDate() - daysSinceMonday);

  const y = anchor.getUTCFullYear();
  const m = String(anchor.getUTCMonth() + 1).padStart(2, "0");
  const d = String(anchor.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the current authentication-week key, or null if today (Sunday)
 * is a reset day where no refresh-token week is considered valid.
 */
function getCurrentAuthWeekKey(date = new Date()) {
  const dayOfWeek = getLocalDayOfWeek(date);
  if (dayOfWeek === 0) return null; // Sunday: force re-login
  return getMondayKeyFor(date);
}

/**
 * Validates a refresh token's stored authWeek against "now".
 */
function isAuthWeekValid(tokenAuthWeek, now = new Date()) {
  const currentWeek = getCurrentAuthWeekKey(now);
  if (!currentWeek) return false; // Sunday reset
  if (!tokenAuthWeek) return false;
  return tokenAuthWeek === currentWeek;
}

module.exports = { getCurrentAuthWeekKey, isAuthWeekValid };
