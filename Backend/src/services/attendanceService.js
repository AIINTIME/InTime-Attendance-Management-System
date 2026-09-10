const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const { ApiError } = require("../middleware/errorMiddleware");
const { verifyWithinOfficeRadius, assertValidCoordinates } = require("./locationService");
const settingsService = require("./settingsService");
const { haversineDistanceMeters } = require("../utils/geoDistance");
const {
  calculateLatenessStatus,
  calculateWorkingMinutes,
  isInsufficientHours,
  applyLoginBuffer,
} = require("../utils/attendanceStatus");
const { getWorkingDateKey } = require("../utils/timezone");

/**
 * Registers OFFICE attendance. Backend is authoritative for the office
 * geofence, the timestamp, and the lateness status (spec sections 25, 62).
 * The admin-configured login buffer (Settings page) is subtracted from the
 * actual login instant before it's stored/evaluated -- check-in only.
 */
async function registerOfficeAttendance(employeeId, { latitude, longitude, accuracy }) {
  const settings = await settingsService.getSettings();
  const checkInTime = applyLoginBuffer(new Date(), settings);
  const workingDateKey = getWorkingDateKey(checkInTime);

  await assertNoExistingAttendance(employeeId, workingDateKey);

  const officeDistanceMeters = await verifyWithinOfficeRadius(latitude, longitude);
  const latenessStatus = calculateLatenessStatus(checkInTime, settings);

  return createAttendanceRecord({
    employeeId,
    workingDateKey,
    date: checkInTime,
    loginType: "OFFICE",
    checkInTime,
    latitude,
    longitude,
    locationAccuracy: accuracy ?? null,
    officeDistanceMeters,
    latenessStatus,
  });
}

/**
 * Registers DISTANCE attendance. No geofence or IP checks (spec section 30).
 */
async function registerDistanceAttendance(employeeId, { latitude, longitude, accuracy, reason }) {
  if (!reason || !reason.trim()) {
    throw new ApiError(422, "A reason is required for distance attendance.", "REASON_REQUIRED");
  }
  assertValidCoordinates(latitude, longitude);

  const settings = await settingsService.getSettings();
  const checkInTime = applyLoginBuffer(new Date(), settings);
  const workingDateKey = getWorkingDateKey(checkInTime);

  await assertNoExistingAttendance(employeeId, workingDateKey);

  const latenessStatus = calculateLatenessStatus(checkInTime, settings);

  return createAttendanceRecord({
    employeeId,
    workingDateKey,
    date: checkInTime,
    loginType: "DISTANCE",
    checkInTime,
    reason: reason.trim(),
    latitude,
    longitude,
    locationAccuracy: accuracy ?? null,
    officeDistanceMeters: null,
    latenessStatus,
  });
}

async function assertNoExistingAttendance(employeeId, workingDateKey) {
  const existing = await Attendance.findOne({ employeeId, workingDateKey });
  if (existing) {
    throw new ApiError(409, "Attendance already registered for today.", "ALREADY_MARKED");
  }
}

async function createAttendanceRecord(data) {
  try {
    return await Attendance.create({ ...data, passkeyVerified: true });
  } catch (err) {
    // Unique index race: two near-simultaneous requests for the same day.
    if (err.code === 11000) {
      throw new ApiError(409, "Attendance already registered for today.", "ALREADY_MARKED");
    }
    throw err;
  }
}

async function getTodayAttendance(employeeId) {
  const workingDateKey = getWorkingDateKey(new Date());
  return Attendance.findOne({ employeeId, workingDateKey });
}

/**
 * Registers check-out against today's attendance record (spec section 45):
 * requires the employee to already have checked in today, requires a fresh
 * passkey verification (enforced by the caller via the same ticket
 * mechanism as check-in), captures server time as the authoritative
 * check-out timestamp, and recalculates working duration / the
 * insufficient-hours flag without touching the original check-in lateness
 * classification.
 */
async function registerCheckOut(employeeId, { latitude, longitude, accuracy } = {}) {
  const workingDateKey = getWorkingDateKey(new Date());
  const attendance = await Attendance.findOne({ employeeId, workingDateKey });

  if (!attendance) {
    throw new ApiError(
      422,
      "You haven't checked in today, so there's nothing to check out from.",
      "NOT_CHECKED_IN"
    );
  }
  if (attendance.checkOutTime) {
    throw new ApiError(409, "You have already checked out for today.", "ALREADY_CHECKED_OUT");
  }

  assertValidCoordinates(latitude, longitude);

  let distanceMeters = null;

  if (attendance.loginType === "OFFICE") {
    distanceMeters = await verifyWithinOfficeRadius(latitude, longitude);
  } else if (attendance.loginType === "DISTANCE") {
    // For remote login, check-out distance must be within 50m of check-in geo-location
    distanceMeters = haversineDistanceMeters(
      attendance.latitude,
      attendance.longitude,
      latitude,
      longitude
    );

    const roundedDistance = Math.round(distanceMeters);

    if (distanceMeters > 50) {
      const err = new ApiError(
        422,
        `Remote check-out must be within 50 meters of your check-in location. You are currently ${roundedDistance}m away.`,
        "OUTSIDE_CHECKIN_RADIUS"
      );
      err.distanceMeters = roundedDistance;
      throw err;
    }
  }

  const checkOutTime = new Date();
  const totalWorkingMinutes = calculateWorkingMinutes(attendance.checkInTime, checkOutTime);

  attendance.checkOutTime = checkOutTime;
  attendance.checkOutLatitude = latitude;
  attendance.checkOutLongitude = longitude;
  attendance.checkOutLocationAccuracy = accuracy ?? null;
  attendance.checkOutDistanceMeters = Math.round(distanceMeters);
  attendance.totalWorkingMinutes = totalWorkingMinutes;
  attendance.insufficientHours = isInsufficientHours(totalWorkingMinutes);

  await attendance.save();
  return attendance;
}

/**
 * Builds a Mongo filter for attendance records shared by admin listing,
 * report preview/count, and Excel/PDF export -- so all three agree on what
 * "matching records" means.
 *
 * filters: { fromDate, toDate, employeeIds, department, loginType, status }
 */
async function buildAttendanceFilter(filters = {}) {
  const match = {};

  if (filters.fromDate || filters.toDate) {
    match.workingDateKey = {};
    if (filters.fromDate) match.workingDateKey.$gte = filters.fromDate;
    if (filters.toDate) match.workingDateKey.$lte = filters.toDate;
  }

  if (filters.loginType) {
    match.loginType = filters.loginType;
  }

  if (filters.status) {
    if (filters.status === "INSUFFICIENT_HOURS") {
      match.insufficientHours = true;
    } else {
      match.latenessStatus = filters.status;
    }
  }

  let employeeIdFilter = null;

  if (filters.employeeIds && filters.employeeIds.length) {
    employeeIdFilter = filters.employeeIds;
  }

  if (filters.department) {
    const deptEmployees = await Employee.find({ department: filters.department }).select("_id");
    const deptIds = deptEmployees.map((e) => e._id.toString());
    employeeIdFilter = employeeIdFilter
      ? employeeIdFilter.filter((id) => deptIds.includes(id.toString()))
      : deptIds;
  }

  if (employeeIdFilter) {
    match.employeeId = { $in: employeeIdFilter };
  }

  return match;
}

async function findAttendanceRecords(filters, { page, limit } = {}) {
  const match = await buildAttendanceFilter(filters);
  let query = Attendance.find(match)
    .populate("employeeId", "employeeId name email department designation profilePhoto")
    .sort({ date: -1 });

  const total = await Attendance.countDocuments(match);

  if (page && limit) {
    query = query.skip((page - 1) * limit).limit(limit);
  }

  const records = await query;
  return { records, total };
}

module.exports = {
  registerOfficeAttendance,
  registerDistanceAttendance,
  getTodayAttendance,
  registerCheckOut,
  buildAttendanceFilter,
  findAttendanceRecords,
};
