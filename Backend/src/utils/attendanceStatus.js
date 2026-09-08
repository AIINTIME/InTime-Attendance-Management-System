const env = require("../config/env");
const { getMinutesSinceMidnight } = require("./timezone");

function parseTimeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const OFFICE_START_MINUTES = parseTimeToMinutes(env.OFFICE_START_TIME);
const SLIGHT_LATE_CUTOFF_MINUTES =
  OFFICE_START_MINUTES + env.SLIGHT_LATE_GRACE_MINUTES;

/**
 * Determines lateness status from a check-in Date, based on the
 * organization's configured office start time (server-authoritative).
 *
 * <= 9:30 AM        -> ON_TIME
 * >  9:30, <= 9:45  -> SLIGHT_LATE
 * >  9:45           -> VERY_LATE
 */
function calculateLatenessStatus(checkInDate) {
  const checkInMinutes = getMinutesSinceMidnight(checkInDate);

  if (checkInMinutes <= OFFICE_START_MINUTES) return "ON_TIME";
  if (checkInMinutes <= SLIGHT_LATE_CUTOFF_MINUTES) return "SLIGHT_LATE";
  return "VERY_LATE";
}

/**
 * Working minutes between check-in and check-out.
 */
function calculateWorkingMinutes(checkInDate, checkOutDate) {
  if (!checkInDate || !checkOutDate) return null;
  return Math.max(
    0,
    Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 60000)
  );
}

function isInsufficientHours(totalWorkingMinutes) {
  if (totalWorkingMinutes === null || totalWorkingMinutes === undefined) {
    return false;
  }
  return totalWorkingMinutes < env.MIN_WORKING_HOURS * 60;
}

module.exports = {
  calculateLatenessStatus,
  calculateWorkingMinutes,
  isInsufficientHours,
  OFFICE_START_MINUTES,
  SLIGHT_LATE_CUTOFF_MINUTES,
};
