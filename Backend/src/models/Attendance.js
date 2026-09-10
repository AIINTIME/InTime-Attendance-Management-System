const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    // Working-date key (YYYY-MM-DD, org timezone) used for one-per-day rule.
    workingDateKey: { type: String, required: true, index: true },
    date: { type: Date, required: true },

    loginType: {
      type: String,
      enum: ["OFFICE", "DISTANCE"],
      required: true,
    },

    checkInTime: { type: Date, required: true },
    checkOutTime: { type: Date, default: null },

    reason: { type: String, default: "" }, // required for DISTANCE

    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    locationAccuracy: { type: Number, default: null },

    officeDistanceMeters: { type: Number, default: null },

    checkOutLatitude: { type: Number, default: null },
    checkOutLongitude: { type: Number, default: null },
    checkOutLocationAccuracy: { type: Number, default: null },
    checkOutDistanceMeters: { type: Number, default: null },

    latenessStatus: {
      type: String,
      enum: ["ON_TIME", "SLIGHT_LATE", "LATE", "VERY_LATE"],
      required: true,
    },
    insufficientHours: { type: Boolean, default: false },

    totalWorkingMinutes: { type: Number, default: null },

    passkeyVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One attendance registration per employee per working date.
attendanceSchema.index({ employeeId: 1, workingDateKey: 1 }, { unique: true });
attendanceSchema.index({ workingDateKey: 1, loginType: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
