const { body, query, param, validationResult } = require("express-validator");
const Employee = require("../models/Employee");
const Admin = require("../models/Admin");
const Attendance = require("../models/Attendance");
const PasskeyCredential = require("../models/PasskeyCredential");
const { ApiError } = require("../middleware/errorMiddleware");
const { hashPassword, comparePassword } = require("../utils/password");
const { getWorkingDateKey } = require("../utils/timezone");
const attendanceService = require("../services/attendanceService");
const { toPublicAdmin } = require("../services/authService");

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(422, errors.array()[0].msg, "VALIDATION_ERROR");
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

async function getDashboard(req, res, next) {
  try {
    const todayKey = getWorkingDateKey(new Date());

    const totalEmployees = await Employee.countDocuments({ isActive: true });

    const [statusCounts] = await Attendance.aggregate([
      { $match: { workingDateKey: todayKey } },
      {
        $group: {
          _id: null,
          present: { $sum: 1 },
          office: { $sum: { $cond: [{ $eq: ["$loginType", "OFFICE"] }, 1, 0] } },
          distance: { $sum: { $cond: [{ $eq: ["$loginType", "DISTANCE"] }, 1, 0] } },
          onTime: { $sum: { $cond: [{ $eq: ["$latenessStatus", "ON_TIME"] }, 1, 0] } },
          slightLate: { $sum: { $cond: [{ $eq: ["$latenessStatus", "SLIGHT_LATE"] }, 1, 0] } },
          veryLate: { $sum: { $cond: [{ $eq: ["$latenessStatus", "VERY_LATE"] }, 1, 0] } },
          insufficientHours: { $sum: { $cond: ["$insufficientHours", 1, 0] } },
        },
      },
    ]);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    const fourteenDaysAgoKey = getWorkingDateKey(fourteenDaysAgo);

    const dailyTrend = await Attendance.aggregate([
      { $match: { workingDateKey: { $gte: fourteenDaysAgoKey } } },
      { $group: { _id: "$workingDateKey", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const departmentBreakdown = await Attendance.aggregate([
      { $match: { workingDateKey: todayKey } },
      {
        $lookup: {
          from: "employees",
          localField: "employeeId",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      { $group: { _id: "$employee.department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const stats = statusCounts || {
      present: 0,
      office: 0,
      distance: 0,
      onTime: 0,
      slightLate: 0,
      veryLate: 0,
      insufficientHours: 0,
    };

    res.json({
      success: true,
      message: "OK",
      data: {
        totalEmployees,
        presentToday: stats.present,
        officeAttendance: stats.office,
        distanceAttendance: stats.distance,
        onTime: stats.onTime,
        slightLate: stats.slightLate,
        veryLate: stats.veryLate,
        insufficientHours: stats.insufficientHours,
        dailyTrend: dailyTrend.map((d) => ({ date: d._id, count: d.count })),
        departmentBreakdown: departmentBreakdown.map((d) => ({
          department: d._id || "Unassigned",
          count: d.count,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

const listEmployeesValidators = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

async function listEmployees(req, res, next) {
  try {
    assertValid(req);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const filter = {};
    if (req.query.search) {
      const regex = new RegExp(req.query.search.trim(), "i");
      filter.$or = [{ name: regex }, { email: regex }, { employeeId: regex }];
    }
    if (req.query.department) filter.department = req.query.department;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";

    const total = await Employee.countDocuments(filter);
    const employees = await Employee.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      message: "OK",
      data: { employees, total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

const createEmployeeValidators = [
  body("employeeId").trim().notEmpty().withMessage("Employee ID is required."),
  body("name").trim().isLength({ min: 2 }).withMessage("Name is required."),
  body("email").isEmail().withMessage("A valid email is required.").normalizeEmail(),
  body("department").trim().notEmpty().withMessage("Department is required."),
  body("designation").trim().notEmpty().withMessage("Designation is required."),
  body("temporaryPassword")
    .isLength({ min: 8 })
    .withMessage("Temporary password must be at least 8 characters."),
];

async function createEmployee(req, res, next) {
  try {
    assertValid(req);
    const { employeeId, name, email, department, designation, temporaryPassword } = req.body;

    const existing = await Employee.findOne({
      $or: [{ email: email.toLowerCase() }, { employeeId: employeeId.toUpperCase() }],
    });
    if (existing) {
      throw new ApiError(409, "An employee with this ID or email already exists.", "EMPLOYEE_EXISTS");
    }

    const passwordHash = await hashPassword(temporaryPassword);
    const employee = await Employee.create({
      employeeId,
      name,
      email,
      department,
      designation,
      passwordHash,
      mustChangePassword: true,
    });

    res.status(201).json({ success: true, message: "Employee created", data: { employee } });
  } catch (err) {
    next(err);
  }
}

async function getEmployeeById(req, res, next) {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) throw new ApiError(404, "Employee not found.", "NOT_FOUND");

    const credentialsCount = await PasskeyCredential.countDocuments({ employeeId: employee._id });

    const totalRecords = await Attendance.countDocuments({ employeeId: employee._id });
    const [statusCounts] = await Attendance.aggregate([
      { $match: { employeeId: employee._id } },
      {
        $group: {
          _id: null,
          onTime: { $sum: { $cond: [{ $eq: ["$latenessStatus", "ON_TIME"] }, 1, 0] } },
          slightLate: { $sum: { $cond: [{ $eq: ["$latenessStatus", "SLIGHT_LATE"] }, 1, 0] } },
          veryLate: { $sum: { $cond: [{ $eq: ["$latenessStatus", "VERY_LATE"] }, 1, 0] } },
          insufficientHours: { $sum: { $cond: ["$insufficientHours", 1, 0] } },
        },
      },
    ]);

    res.json({
      success: true,
      message: "OK",
      data: {
        employee,
        passkeyCredentialsCount: credentialsCount,
        attendanceStats: {
          totalRecords,
          onTime: statusCounts?.onTime || 0,
          slightLate: statusCounts?.slightLate || 0,
          veryLate: statusCounts?.veryLate || 0,
          insufficientHours: statusCounts?.insufficientHours || 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

const updateEmployeeValidators = [
  body("name").optional().trim().isLength({ min: 2 }),
  body("department").optional().trim().notEmpty(),
  body("designation").optional().trim().notEmpty(),
];

async function updateEmployee(req, res, next) {
  try {
    assertValid(req);
    const employee = await Employee.findById(req.params.id);
    if (!employee) throw new ApiError(404, "Employee not found.", "NOT_FOUND");

    const { name, department, designation } = req.body;
    if (name) employee.name = name;
    if (department) employee.department = department;
    if (designation) employee.designation = designation;
    await employee.save();

    res.json({ success: true, message: "Employee updated", data: { employee } });
  } catch (err) {
    next(err);
  }
}

const resetPasswordValidators = [
  body("temporaryPassword")
    .isLength({ min: 8 })
    .withMessage("Temporary password must be at least 8 characters."),
];

async function resetEmployeePassword(req, res, next) {
  try {
    assertValid(req);
    const employee = await Employee.findById(req.params.id);
    if (!employee) throw new ApiError(404, "Employee not found.", "NOT_FOUND");

    employee.passwordHash = await hashPassword(req.body.temporaryPassword);
    employee.mustChangePassword = true;
    await employee.save();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    next(err);
  }
}

const statusValidators = [body("isActive").isBoolean().withMessage("isActive must be true or false.")];

async function setEmployeeStatus(req, res, next) {
  try {
    assertValid(req);
    const employee = await Employee.findById(req.params.id);
    if (!employee) throw new ApiError(404, "Employee not found.", "NOT_FOUND");

    employee.isActive = req.body.isActive;
    await employee.save();

    res.json({ success: true, message: "Employee status updated", data: { employee } });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Attendance (all employees)
// ---------------------------------------------------------------------------

const listAttendanceValidators = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

async function listAttendance(req, res, next) {
  try {
    assertValid(req);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const filters = {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      employeeIds: req.query.employeeIds ? req.query.employeeIds.split(",") : undefined,
      department: req.query.department,
      loginType: req.query.loginType,
      status: req.query.status,
    };

    const { records, total } = await attendanceService.findAttendanceRecords(filters, { page, limit });

    res.json({
      success: true,
      message: "OK",
      data: { records, total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

const employeeAttendanceHistoryValidators = [param("id").isMongoId()];

async function getEmployeeAttendanceHistory(req, res, next) {
  try {
    assertValid(req);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const filters = {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      employeeIds: [req.params.id],
      loginType: req.query.loginType,
      status: req.query.status,
    };

    const { records, total } = await attendanceService.findAttendanceRecords(filters, { page, limit });

    res.json({
      success: true,
      message: "OK",
      data: { records, total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Admin's own profile
// ---------------------------------------------------------------------------

const updateProfileValidators = [body("name").optional().trim().isLength({ min: 2 })];

async function updateProfile(req, res, next) {
  try {
    assertValid(req);
    if (req.body.name) req.admin.name = req.body.name;
    await req.admin.save();
    res.json({ success: true, message: "Profile updated", data: { user: toPublicAdmin(req.admin) } });
  } catch (err) {
    next(err);
  }
}

const changeOwnPasswordValidators = [
  body("currentPassword").notEmpty().withMessage("Current password is required."),
  body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 characters."),
  body("confirmNewPassword")
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("Passwords do not match."),
];

async function changeOwnPassword(req, res, next) {
  try {
    assertValid(req);
    const admin = await Admin.findById(req.admin._id).select("+passwordHash");
    const valid = await comparePassword(req.body.currentPassword, admin.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Current password is incorrect.", "INVALID_CURRENT_PASSWORD");
    }
    admin.passwordHash = await hashPassword(req.body.newPassword);
    await admin.save();
    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
}

async function uploadProfilePhoto(req, res, next) {
  try {
    if (!req.uploadedFilePath) {
      throw new ApiError(422, "A valid image file is required.", "NO_FILE");
    }
    req.admin.profilePhoto = req.uploadedFilePath;
    await req.admin.save();
    res.json({ success: true, message: "Profile photo updated", data: { profilePhoto: req.admin.profilePhoto } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboard,
  updateProfileValidators,
  updateProfile,
  changeOwnPasswordValidators,
  changeOwnPassword,
  uploadProfilePhoto,
  listEmployeesValidators,
  listEmployees,
  createEmployeeValidators,
  createEmployee,
  getEmployeeById,
  updateEmployeeValidators,
  updateEmployee,
  resetPasswordValidators,
  resetEmployeePassword,
  statusValidators,
  setEmployeeStatus,
  listAttendanceValidators,
  listAttendance,
  employeeAttendanceHistoryValidators,
  getEmployeeAttendanceHistory,
};
