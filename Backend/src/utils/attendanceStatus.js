const env = require("../config/env");
const { getMinutesSinceMidnight } = require("./timezone");

function parseTimeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Determines lateness status from a check-in Date, against the
 * organization's admin-configured office start time and grace windows
 * (Settings page) -- server-authoritative.
 *
 * Both grace values stack on top of checkInTime:
 *   <= checkInTime                                              -> ON_TIME
 *   <= checkInTime + slightLateGraceMinutes + veryLateGraceMinutes -> SLIGHT_LATE
 *   beyond that                                                 -> VERY_LATE
 *
 * i.e. slightLateGraceMinutes is the first stretch of tolerance, and
 * veryLateGraceMinutes is *additional* tolerance layered on top of it
 * before a check-in is marked VERY_LATE -- moving either slider pushes the
 * VERY_LATE cutoff out.
 */
function calculateLatenessStatus(checkInDate, settings) {
  const officeStartMinutes = parseTimeToMinutes(settings.checkInTime);
  const slightLateCutoff = officeStartMinutes + (settings.slightLateGraceMinutes || 5);
  const lateCutoff = officeStartMinutes + (settings.lateGraceMinutes || 15);
  const veryLateCutoff = officeStartMinutes + (settings.veryLateGraceMinutes || 30);

  const checkInMinutes = getMinutesSinceMidnight(checkInDate);

  if (checkInMinutes <= officeStartMinutes) return "ON_TIME";
  if (checkInMinutes <= slightLateCutoff) return "SLIGHT_LATE";
  if (checkInMinutes <= lateCutoff) return "LATE";
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

/**
 * Subtracts the admin-configured login buffer from the actual check-in
 * instant -- check-in only, never check-out (spec: "login takes some time,
 * so a 2-minute buffer means a 10:07 login registers as 10:05").
 */
function applyLoginBuffer(checkInDate, settings) {
  return new Date(checkInDate.getTime() - settings.loginBufferMinutes * 60000);
}

module.exports = {
  calculateLatenessStatus,
  calculateWorkingMinutes,
  isInsufficientHours,
  applyLoginBuffer,
};
