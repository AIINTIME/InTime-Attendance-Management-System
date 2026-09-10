const { query, validationResult } = require("express-validator");
const attendanceService = require("../services/attendanceService");
const reportService = require("../services/reportService");
const { ApiError } = require("../middleware/errorMiddleware");

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(422, errors.array()[0].msg, "VALIDATION_ERROR");
  }
}

function filtersFromQuery(req) {
  return {
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
    employeeIds: req.query.employeeIds ? req.query.employeeIds.split(",") : undefined,
    department: req.query.department,
    loginType: req.query.loginType,
    status: req.query.status,
  };
}

const reportValidators = [
  query("fromDate").optional().isISO8601(),
  query("toDate").optional().isISO8601(),
];

async function previewReport(req, res, next) {
  try {
    assertValid(req);
    const filters = filtersFromQuery(req);
    const { records, total } = await attendanceService.findAttendanceRecords(filters, {
      page: 1,
      limit: 25,
    });
    res.json({ success: true, message: "OK", data: { records, total } });
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    assertValid(req);
    const filters = filtersFromQuery(req);
    const period = reportService.resolvePeriod(filters);
    Object.assign(filters, period);
    const { records } = await attendanceService.findAttendanceRecords(filters);
    const buffer = await reportService.generateExcelBuffer(records, period);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="attendance-report.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function exportPdf(req, res, next) {
  try {
    assertValid(req);
    const filters = filtersFromQuery(req);
    const period = reportService.resolvePeriod(filters);
    Object.assign(filters, period);
    const { records } = await attendanceService.findAttendanceRecords(filters);
    const buffer = await reportService.generatePdfBuffer(records, period);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-report.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { reportValidators, previewReport, exportExcel, exportPdf };
