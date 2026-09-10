const OrgSettings = require("../models/OrgSettings");
const env = require("../config/env");

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
      { dayOfWeek: 6, occurrence: 1 },
      { dayOfWeek: 6, occurrence: 3 },
    ],
  };
}

/**
 * Returns the current org settings, creating the singleton document (seeded
 * from the .env defaults that used to be the only source of truth) the
 * first time it's ever read.
 */
async function getSettings() {
  if (cached) return cached;

  let doc = await OrgSettings.findOne({ key: OrgSettings.SETTINGS_KEY });
  if (!doc) {
    doc = await OrgSettings.create({ key: OrgSettings.SETTINGS_KEY, ...defaults() });
  }
  cached = doc.toObject();
  return cached;
}

async function updateSettings(patch) {
  // Make sure the singleton exists (with every required field filled in)
  // before patching it -- an upsert here could otherwise create a document
  // missing whatever required fields weren't part of this particular patch.
  await getSettings();

  const doc = await OrgSettings.findOneAndUpdate(
    { key: OrgSettings.SETTINGS_KEY },
    { $set: patch },
    { new: true, runValidators: true }
  );
  cached = doc.toObject();
  return cached;
}

module.exports = { getSettings, updateSettings };
