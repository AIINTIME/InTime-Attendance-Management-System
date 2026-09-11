const { body, validationResult } = require("express-validator");
const settingsService = require("../services/settingsService");
const { ApiError } = require("../middleware/errorMiddleware");

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(422, errors.array()[0].msg, "VALIDATION_ERROR");
  }
}

async function getSettings(req, res, next) {
  try {
    const settings = await settingsService.getSettings();
    res.json({ success: true, message: "OK", data: { settings } });
  } catch (err) {
    next(err);
  }
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const updateSettingsValidators = [
  body("officeAddress").optional().isString().trim(),
  body("officeLatitude").isFloat({ min: -90, max: 90 }).withMessage("A valid office latitude is required."),
  body("officeLongitude").isFloat({ min: -180, max: 180 }).withMessage("A valid office longitude is required."),
  body("officeRadiusMeters").isFloat({ min: 1 }).withMessage("Office radius must be a positive number."),
  body("checkInTime").matches(TIME_REGEX).withMessage("Check-in time must be in HH:mm format."),
  body("checkOutTime").matches(TIME_REGEX).withMessage("Check-out time must be in HH:mm format."),
  body("loginBufferMinutes")
    .isFloat({ min: 0.5, max: 5 })
    .withMessage("Login buffer must be between 30 seconds and 5 minutes."),
  body("slightLateGraceMinutes")
    .isInt({ min: 1, max: 30 })
    .withMessage("Slight-late grace must be between 1 and 30 minutes."),
  body("lateGraceMinutes")
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage("Late grace must be between 1 and 30 minutes."),
  body("veryLateGraceMinutes")
    .isInt({ min: 1, max: 30 })
    .withMessage("Very-late grace must be between 1 and 30 minutes."),
  body("halfDayRules").optional().isArray().withMessage("Half-day rules must be a list."),
  body("halfDayRules.*.dayOfWeek").isInt({ min: 0, max: 6 }).withMessage("Invalid day of week in half-day rule."),
  body("halfDayRules.*.occurrence").isInt({ min: 1, max: 5 }).withMessage("Invalid occurrence in half-day rule."),
  body("holidays").optional().isArray().withMessage("Holidays must be a list."),
];

async function updateSettings(req, res, next) {
  try {
    assertValid(req);
    const {
      officeAddress,
      officeLatitude,
      officeLongitude,
      officeRadiusMeters,
      checkInTime,
      checkOutTime,
      loginBufferMinutes,
      slightLateGraceMinutes,
      lateGraceMinutes,
      veryLateGraceMinutes,
      halfDayRules,
      holidays,
    } = req.body;

    const patch = {
      officeLatitude,
      officeLongitude,
      officeRadiusMeters,
      checkInTime,
      checkOutTime,
      loginBufferMinutes,
      slightLateGraceMinutes,
      veryLateGraceMinutes,
      halfDayRules: halfDayRules ?? [],
    };
    if (officeAddress !== undefined) patch.officeAddress = officeAddress;
    if (lateGraceMinutes !== undefined) patch.lateGraceMinutes = lateGraceMinutes;
    if (holidays !== undefined) patch.holidays = holidays;

    const settings = await settingsService.updateSettings(patch);

    res.json({ success: true, message: "Settings updated", data: { settings } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSettings, updateSettingsValidators, updateSettings };
