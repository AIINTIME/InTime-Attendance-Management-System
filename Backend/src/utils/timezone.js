const env = require("../config/env");

/**
 * Returns { year, month, day, hour, minute, second } for the given Date,
 * interpreted in the organization's configured timezone (APP_TIMEZONE).
 */
function getLocalParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: env.APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour === "24" ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * Returns a YYYY-MM-DD string representing the "working date" for a given
 * instant, in the organization's timezone. Used as the de-duplication key
 * for one-attendance-per-day business rules.
 */
function getWorkingDateKey(date = new Date()) {
  const { year, month, day } = getLocalParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Minutes since midnight (local org timezone) for the given instant.
 */
function getMinutesSinceMidnight(date = new Date()) {
  const { hour, minute } = getLocalParts(date);
  return hour * 60 + minute;
}

/**
 * Day of week in the org timezone: 0 = Sunday ... 6 = Saturday.
 */
function getLocalDayOfWeek(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: env.APP_TIMEZONE,
    weekday: "short",
  });
  const weekday = formatter.format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday];
}

module.exports = {
  getLocalParts,
  getWorkingDateKey,
  getMinutesSinceMidnight,
  getLocalDayOfWeek,
};
