const { body, query, validationResult } = require("express-validator");
const attendanceService = require("../services/attendanceService");
const settingsService = require("../services/settingsService");
const prisma = require("../config/prisma");
const { ApiError } = require("../middleware/errorMiddleware");
const { verifyPasskeyTicket } = require("../utils/jwt");
const { computeWorkingDaysInfo } = require("../utils/workingDays");

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(422, errors.array()[0].msg, "VALIDATION_ERROR");
  }
}

function requirePasskeyTicket(req) {
  const { passkeyTicket } = req.body;
  if (!passkeyTicket || !verifyPasskeyTicket(passkeyTicket, req.employee.id.toString())) {
    throw new ApiError(
      401,
      "Passkey verification is required before marking attendance.",
      "PASSKEY_VERIFICATION_REQUIRED"
    );
  }
}

const officeAttendanceValidators = [
  body("latitude").isFloat({ min: -90, max: 90 }).withMessage("A valid latitude is required."),
  body("longitude").isFloat({ min: -180, max: 180 }).withMessage("A valid longitude is required."),
  body("accuracy").optional().isFloat({ min: 0 }),
];

async function registerOffice(req, res, next) {
  try {
    assertValid(req);
    requirePasskeyTicket(req);

    const { latitude, longitude, accuracy } = req.body;
    const attendance = await attendanceService.registerOfficeAttendance(req.employee.id, {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy ? Number(accuracy) : null,
    });

    res.status(201).json({
      success: true,
      message: "Attendance registered successfully",
      data: { attendance },
    });
  } catch (err) {
    next(err);
  }
}

const distanceAttendanceValidators = [
  body("latitude").isFloat({ min: -90, max: 90 }).withMessage("A valid latitude is required."),
  body("longitude").isFloat({ min: -180, max: 180 }).withMessage("A valid longitude is required."),
  body("accuracy").optional().isFloat({ min: 0 }),
  body("reason").trim().notEmpty().withMessage("A reason is required for distance attendance."),
];

async function registerDistance(req, res, next) {
  try {
    assertValid(req);
    requirePasskeyTicket(req);

    const { latitude, longitude, accuracy, reason } = req.body;
    const attendance = await attendanceService.registerDistanceAttendance(req.employee.id, {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy ? Number(accuracy) : null,
      reason,
    });

    res.status(201).json({
      success: true,
      message: "Attendance registered successfully",
      data: { attendance },
    });
  } catch (err) {
    next(err);
  }
}

const checkOutValidators = [
  body("latitude").isFloat({ min: -90, max: 90 }).withMessage("A valid latitude is required for check-out."),
  body("longitude").isFloat({ min: -180, max: 180 }).withMessage("A valid longitude is required for check-out."),
  body("accuracy").optional().isFloat({ min: 0 }),
];

async function checkOut(req, res, next) {
  try {
    assertValid(req);
    requirePasskeyTicket(req);

    const { latitude, longitude, accuracy } = req.body;
    const attendance = await attendanceService.registerCheckOut(req.employee.id, {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy ? Number(accuracy) : null,
    });

    res.json({
      success: true,
      message: "Checked out successfully",
      data: { attendance },
    });
  } catch (err) {
    next(err);
  }
}

async function today(req, res, next) {
  try {
    const attendance = await attendanceService.getTodayAttendance(req.employee.id);
    res.json({ success: true, message: "OK", data: { attendance } });
  } catch (err) {
    next(err);
  }
}

const myRecordsValidators = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

async function myRecords(req, res, next) {
  try {
    assertValid(req);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const where = { employeeId: req.employee.id };
    if (req.query.fromDate) where.workingDateKey = { ...where.workingDateKey, gte: req.query.fromDate };
    if (req.query.toDate) where.workingDateKey = { ...where.workingDateKey, lte: req.query.toDate };
    if (req.query.loginType) where.loginType = req.query.loginType;
    if (req.query.status) {
      if (req.query.status === "INSUFFICIENT_HOURS") where.insufficientHours = true;
      else where.latenessStatus = req.query.status;
    }

    const total = await prisma.attendance.count({ where });
    const records = await prisma.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({
      success: true,
      message: "OK",
      data: { records, total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

const workingDaysValidators = [
  query("year").isInt({ min: 2000, max: 2100 }).withMessage("A valid year is required."),
  query("month").isInt({ min: 1, max: 12 }).withMessage("A valid month (1-12) is required."),
];

/**
 * Real working-day count for a calendar month (Sundays excluded, admin-
 * configured half-day Saturdays counted as 0.5) -- backend-authoritative
 * since halfDayRules live in OrgSettings, not something the client can
 * compute on its own (spec: Settings page half-day config must be
 * reflected in the employee Report page's Present/Absent cards).
 */
async function workingDays(req, res, next) {
  try {
    assertValid(req);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    const settings = await settingsService.getSettings();
    const { totalWorkingDays, workingDaysElapsed, workingSaturdays } = computeWorkingDaysInfo(
      year,
      month,
      settings.halfDayRules
    );

    res.json({
      success: true,
      message: "OK",
      data: { year, month, totalWorkingDays, workingDaysElapsed, workingSaturdays },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  officeAttendanceValidators,
  distanceAttendanceValidators,
  checkOutValidators,
  myRecordsValidators,
  workingDaysValidators,
  registerOffice,
  registerDistance,
  checkOut,
  workingDays,
  today,
  myRecords,
};
