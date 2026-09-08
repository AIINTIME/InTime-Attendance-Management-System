const { body, query, validationResult } = require("express-validator");
const attendanceService = require("../services/attendanceService");
const Attendance = require("../models/Attendance");
const { ApiError } = require("../middleware/errorMiddleware");
const { verifyPasskeyTicket } = require("../utils/jwt");

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(422, errors.array()[0].msg, "VALIDATION_ERROR");
  }
}

function requirePasskeyTicket(req) {
  const { passkeyTicket } = req.body;
  if (!passkeyTicket || !verifyPasskeyTicket(passkeyTicket, req.employee._id.toString())) {
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
    const attendance = await attendanceService.registerOfficeAttendance(req.employee._id, {
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
    const attendance = await attendanceService.registerDistanceAttendance(req.employee._id, {
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
    const attendance = await attendanceService.registerCheckOut(req.employee._id, {
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
    const attendance = await attendanceService.getTodayAttendance(req.employee._id);
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

    const filter = { employeeId: req.employee._id };
    if (req.query.fromDate) filter.workingDateKey = { ...filter.workingDateKey, $gte: req.query.fromDate };
    if (req.query.toDate) filter.workingDateKey = { ...filter.workingDateKey, $lte: req.query.toDate };
    if (req.query.loginType) filter.loginType = req.query.loginType;
    if (req.query.status) {
      if (req.query.status === "INSUFFICIENT_HOURS") filter.insufficientHours = true;
      else filter.latenessStatus = req.query.status;
    }

    const total = await Attendance.countDocuments(filter);
    const records = await Attendance.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      message: "OK",
      data: { records, total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
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
  registerOffice,
  registerDistance,
  checkOut,
  today,
  myRecords,
};
