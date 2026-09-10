const mongoose = require("mongoose");

// Singleton document (always looked up/created with SETTINGS_KEY) holding
// the organization-wide attendance rules the admin can tune from the
// Settings page, replacing what used to be fixed .env values.
const SETTINGS_KEY = "org";

const halfDayRuleSchema = new mongoose.Schema(
  {
    // 0 = Sunday ... 6 = Saturday
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    // Which occurrence of that weekday in the month: 1-4, or 5 to mean
    // "last" (some months don't have a 5th occurrence -- last is safer
    // than a literal 5th that may not exist).
    occurrence: { type: Number, required: true, min: 1, max: 5 },
  },
  { _id: false }
);

const orgSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: SETTINGS_KEY, unique: true },

    officeAddress: { type: String, default: "Salt Lake, Kolkata, West Bengal, India" },
    officeLatitude: { type: Number, required: true },
    officeLongitude: { type: Number, required: true },
    officeRadiusMeters: { type: Number, required: true, min: 1 },

    checkInTime: { type: String, required: true }, // "HH:mm"
    checkOutTime: { type: String, required: true }, // "HH:mm"

    // Minutes subtracted from the actual check-in timestamp before it's
    // stored/evaluated for lateness, to absorb app/GPS-lock delay. Applies
    // to check-in only, never check-out. 0.5-5, half-minute steps.
    loginBufferMinutes: { type: Number, required: true, min: 0.5, max: 5 },

    // Minutes of grace after checkInTime before a check-in flips from
    // ON_TIME to SLIGHT_LATE.
    slightLateGraceMinutes: { type: Number, required: true, min: 1, max: 30, default: 5 },
    // Minutes of grace for LATE status.
    lateGraceMinutes: { type: Number, default: 15, min: 1, max: 30 },
    // Cutoff minutes after which check-in flips to VERY_LATE.
    veryLateGraceMinutes: { type: Number, required: true, min: 1, max: 30, default: 30 },

    halfDayRules: { type: [halfDayRuleSchema], default: [] },
  },
  { timestamps: true }
);

orgSettingsSchema.statics.SETTINGS_KEY = SETTINGS_KEY;

module.exports = mongoose.model("OrgSettings", orgSettingsSchema);
