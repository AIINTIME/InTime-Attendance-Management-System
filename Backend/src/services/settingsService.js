const prisma = require("../config/prisma");
const env = require("../config/env");

const SETTINGS_KEY = "org";

// Cached in memory so hot paths (every check-in/check-out) don't hit the
// DB. Invalidated on every write from the Settings page; a cold cache also
// just falls through to a fresh DB read.
let cached = null;

function defaults() {
  return {
    officeAddress: "INTIME IT SERVICES PVT. LTD, Ruby Park East, Kasba, Kolkata, West Bengal 700078",
    officeLatitude: env.OFFICE_LATITUDE || 22.51238080138918,
    officeLongitude: env.OFFICE_LONGITUDE || 88.39112588370692,
    officeRadiusMeters: env.OFFICE_RADIUS_METERS || 100,
    checkInTime: env.OFFICE_START_TIME,
    checkOutTime: env.OFFICE_END_TIME,
    loginBufferMinutes: 2,
    slightLateGraceMinutes: 5,
    lateGraceMinutes: 15,
    veryLateGraceMinutes: 30,
    halfDayRules: [
      { dayOfWeek: 6, occurrence: 2 },
      { dayOfWeek: 6, occurrence: 4 },
    ],
    holidays: [
      { date: "2026-01-26", name: "Republic Day", description: "National Holiday" },
      { date: "2026-03-14", name: "Holi", description: "Festival" },
      { date: "2026-03-29", name: "Good Friday", description: "Restricted Holiday" },
      { date: "2026-04-10", name: "Id-ul-Fitr", description: "Festival" },
      { date: "2026-08-15", name: "Independence Day", description: "National Holiday" },
    ],
  };
}

/**
 * Returns the current org settings, creating the singleton row (seeded
 * from the .env defaults that used to be the only source of truth) the
 * first time it's ever read.
 */
async function getSettings() {
  if (cached) return cached;

  let doc = await prisma.orgSettings.findUnique({ where: { key: SETTINGS_KEY } });
  if (!doc) {
    doc = await prisma.orgSettings.create({ data: { key: SETTINGS_KEY, ...defaults() } });
  }
  cached = doc;
  return cached;
}

async function updateSettings(patch) {
  // Make sure the singleton exists (with every required field filled in)
  // before patching it -- an upsert here could otherwise create a row
  // missing whatever required fields weren't part of this particular patch.
  await getSettings();

  const doc = await prisma.orgSettings.update({
    where: { key: SETTINGS_KEY },
    data: patch,
  });
  cached = doc;
  return cached;
}

module.exports = { getSettings, updateSettings, SETTINGS_KEY };
