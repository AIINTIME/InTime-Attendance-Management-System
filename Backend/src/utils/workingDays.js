const { getLocalParts } = require("./timezone");

// Sunday is always a non-working day (see authService.js's "Sunday is a
// non-working reset period" framing). A Saturday the admin has marked as a
// half-day (Settings page) is treated as a full day off here too -- it
// doesn't count toward working days at all, exactly like Sunday.
const SUNDAY = 0;
const SATURDAY = 6;

/**
 * Which occurrence (1st..5th) of its weekday `date` is within its month,
 * by literal count -- e.g. the 22nd is the 4th Sunday/Monday/etc.
 */
function literalOccurrenceInMonth(day) {
  return Math.ceil(day / 7);
}

/** True if there is no later day in the month with the same day-of-week. */
function isLastOccurrenceOfWeekday(year, month, day) {
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day + 7 > lastDayOfMonth;
}

/**
 * Whether `day` (1-31) of `year`-`month` (month: 1-12) is a configured
 * half-day, per the org's halfDayRules (see OrgSettings model: `occurrence`
 * 1-4 means that literal occurrence, 5 means "last", covering months with
 * only 4 Saturdays).
 */
function isConfiguredHalfDay(year, month, day, dayOfWeek, halfDayRules) {
  if (!halfDayRules || halfDayRules.length === 0) return false;
  const occurrence = literalOccurrenceInMonth(day);
  return halfDayRules.some((rule) => {
    return rule.dayOfWeek === dayOfWeek && rule.occurrence === occurrence;
  });
}

/**
 * Real working-day count for a given calendar month, backend-authoritative
 * (spec: half-day/off Saturdays are set on the admin Settings page and must
 * be reflected everywhere "days in this month" is shown, e.g. the employee
 * Report page's Present/In Office/Remote/Absent cards).
 *
 * A day counts toward `totalWorkingDays` only if it's neither a Sunday nor
 * one of the admin-configured off Saturdays -- e.g. September 2026 has 30
 * calendar days, 4 Sundays (6th/13th/20th/27th), and if the admin marks the
 * 2nd and 4th Saturday (12th/26th) off, that's 30 - 4 - 2 = 24 working days.
 *
 * `totalWorkingDays` covers the whole month; `workingDaysElapsed` covers
 * only days up to and including `referenceDate` (today, in the org
 * timezone) -- 0 for a future month, the same as `totalWorkingDays` for a
 * fully-past month. `workingSaturdays` is the count of full (non-off)
 * Saturdays in the month, for the whole month regardless of `referenceDate`
 * -- used only as the Remote card's denominator, since remote work is the
 * org's allowance specifically for those Saturdays.
 */
function computeWorkingDaysInfo(year, month, halfDayRules, referenceDate = new Date()) {
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = getLocalParts(referenceDate);

  let upToDay;
  if (year < today.year || (year === today.year && month < today.month)) {
    upToDay = lastDayOfMonth;
  } else if (year === today.year && month === today.month) {
    upToDay = today.day;
  } else {
    upToDay = 0;
  }

  let totalWorkingDays = 0;
  let workingDaysElapsed = 0;
  let workingSaturdays = 0;

  for (let day = 1; day <= lastDayOfMonth; day++) {
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (dayOfWeek === SUNDAY) continue;

    if (dayOfWeek === SATURDAY) {
      if (isConfiguredHalfDay(year, month, day, dayOfWeek, halfDayRules)) continue; // off entirely
      workingSaturdays += 1;
    }

    totalWorkingDays += 1;
    if (day <= upToDay) workingDaysElapsed += 1;
  }

  return { totalWorkingDays, workingDaysElapsed, workingSaturdays };
}

module.exports = { computeWorkingDaysInfo };
