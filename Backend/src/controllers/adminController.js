const { body, query, param, validationResult } = require("express-validator");
const prisma = require("../config/prisma");
const { ApiError } = require("../middleware/errorMiddleware");
const { hashPassword, comparePassword } = require("../utils/password");
const { getWorkingDateKey } = require("../utils/timezone");
const attendanceService = require("../services/attendanceService");
const { toPublicAdmin } = require("../services/authService");
const { sanitizeEmployee } = require("../utils/serialize");

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(422, errors.array()[0].msg, "VALIDATION_ERROR");
  }
}

// Every newly created employee starts with this password and
// `mustChangePassword: true`, forcing them to set their own at first login.
const DEFAULT_TEMPORARY_PASSWORD = "Welcome@26INT";

// Scans existing "EMP<n>" ids for the highest n and returns the next one
// (EMP01, EMP02, ... EMP10, ... EMP100). Combined with the retry-on-conflict
// loop in createEmployee, this stays correct even if two admins create an
// employee at the same moment.
async function generateNextEmployeeId() {
  const employees = await prisma.employee.findMany({
    where: { employeeId: { startsWith: "EMP" } },
    select: { employeeId: true },
  });
  let max = 0;
  for (const { employeeId } of employees) {
    const match = /^EMP(\d+)$/i.exec(employeeId);
    if (match) {
      const value = parseInt(match[1], 10);
      if (value > max) max = value;
    }
  }
  return `EMP${String(max + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

async function getDashboard(req, res, next) {
  try {
    const todayKey = getWorkingDateKey(new Date());

    const totalEmployees = await prisma.employee.count({ where: { isActive: true } });

    const todaysAttendance = await prisma.attendance.findMany({
      where: { workingDateKey: todayKey },
      select: {
        loginType: true,
        latenessStatus: true,
        insufficientHours: true,
        employee: { select: { department: true } },
      },
    });

    const stats = {
      present: todaysAttendance.length,
      office: 0,
      distance: 0,
      onTime: 0,
      slightLate: 0,
      veryLate: 0,
      insufficientHours: 0,
    };
    const departmentCounts = new Map();
    for (const record of todaysAttendance) {
      if (record.loginType === "OFFICE") stats.office += 1;
      if (record.loginType === "DISTANCE") stats.distance += 1;
      if (record.latenessStatus === "ON_TIME") stats.onTime += 1;
      if (record.latenessStatus === "SLIGHT_LATE") stats.slightLate += 1;
      if (record.latenessStatus === "VERY_LATE") stats.veryLate += 1;
      if (record.insufficientHours) stats.insufficientHours += 1;

      const dept = record.employee?.department || "Unassigned";
      departmentCounts.set(dept, (departmentCounts.get(dept) || 0) + 1);
    }
    const departmentBreakdown = Array.from(departmentCounts.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    const fourteenDaysAgoKey = getWorkingDateKey(fourteenDaysAgo);

    const trendRows = await prisma.attendance.findMany({
      where: { workingDateKey: { gte: fourteenDaysAgoKey } },
      select: { workingDateKey: true },
    });
    const trendCounts = new Map();
    for (const { workingDateKey } of trendRows) {
      trendCounts.set(workingDateKey, (trendCounts.get(workingDateKey) || 0) + 1);
    }
    const dailyTrend = Array.from(trendCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

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
        dailyTrend,
        departmentBreakdown,
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

    const where = {};
    if (req.query.search) {
      const search = req.query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { employeeId: { contains: search, mode: "insensitive" } },
      ];
    }
    if (req.query.department) where.department = req.query.department;
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === "true";

    const total = await prisma.employee.count({ where });
    const employees = await prisma.employee.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({
      success: true,
      message: "OK",
      data: {
        employees: employees.map(sanitizeEmployee),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

const createEmployeeValidators = [
  body("name").trim().isLength({ min: 2 }).withMessage("Name is required."),
  body("email").isEmail().withMessage("A valid email is required.").normalizeEmail(),
  body("department").trim().notEmpty().withMessage("Department is required."),
  body("designation").trim().notEmpty().withMessage("Designation is required."),
  body("phone").optional({ checkFalsy: true }).trim(),
];

async function createEmployee(req, res, next) {
  try {
    assertValid(req);
    const { name, email, department, designation, phone } = req.body;

    const existing = await prisma.employee.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      throw new ApiError(409, "An employee with this email already exists.", "EMPLOYEE_EXISTS");
    }

    const passwordHash = await hashPassword(DEFAULT_TEMPORARY_PASSWORD);

    let employee;
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const employeeId = await generateNextEmployeeId();
      try {
        employee = await prisma.employee.create({
          data: {
            employeeId,
            name,
            email: email.toLowerCase(),
            department,
            designation,
            phone: phone || "",
            passwordHash,
            mustChangePassword: true,
          },
        });
        break;
      } catch (err) {
        const isDuplicateId = err.code === "P2002" && err.meta?.target?.includes("employeeId");
        if (isDuplicateId && attempt < MAX_ATTEMPTS) continue;
        throw err;
      }
    }

    res.status(201).json({
      success: true,
      message: "Employee created",
      data: { employee: sanitizeEmployee(employee), temporaryPassword: DEFAULT_TEMPORARY_PASSWORD },
    });
  } catch (err) {
    next(err);
  }
}

async function getEmployeeById(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) throw new ApiError(404, "Employee not found.", "NOT_FOUND");

    const credentialsCount = await prisma.passkeyCredential.count({ where: { employeeId: employee.id } });

    const totalRecords = await prisma.attendance.count({ where: { employeeId: employee.id } });
    const statusRows = await prisma.attendance.findMany({
      where: { employeeId: employee.id },
      select: { latenessStatus: true, insufficientHours: true },
    });
    const statusCounts = { onTime: 0, slightLate: 0, veryLate: 0, insufficientHours: 0 };
    for (const row of statusRows) {
      if (row.latenessStatus === "ON_TIME") statusCounts.onTime += 1;
      if (row.latenessStatus === "SLIGHT_LATE") statusCounts.slightLate += 1;
      if (row.latenessStatus === "VERY_LATE") statusCounts.veryLate += 1;
      if (row.insufficientHours) statusCounts.insufficientHours += 1;
    }

    res.json({
      success: true,
      message: "OK",
      data: {
        employee: sanitizeEmployee(employee),
        passkeyCredentialsCount: credentialsCount,
        attendanceStats: { totalRecords, ...statusCounts },
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
  body("phone").optional({ checkFalsy: true }).trim(),
];

async function updateEmployee(req, res, next) {
  try {
    assertValid(req);
    const existing = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Employee not found.", "NOT_FOUND");

    const { name, department, designation, phone } = req.body;
    const data = {};
    if (name) data.name = name;
    if (department) data.department = department;
    if (designation) data.designation = designation;
    if (phone !== undefined) data.phone = phone;

    const employee = await prisma.employee.update({ where: { id: existing.id }, data });

    res.json({ success: true, message: "Employee updated", data: { employee: sanitizeEmployee(employee) } });
  } catch (err) {
    next(err);
  }
}

const resetPasswordValidators = [
  body("temporaryPassword")
    .optional({ checkFalsy: true })
    .isLength({ min: 8 })
    .withMessage("Temporary password must be at least 8 characters."),
];

async function resetEmployeePassword(req, res, next) {
  try {
    assertValid(req);
    const existing = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Employee not found.", "NOT_FOUND");

    const temporaryPassword = req.body.temporaryPassword || DEFAULT_TEMPORARY_PASSWORD;
    const passwordHash = await hashPassword(temporaryPassword);
    await prisma.employee.update({
      where: { id: existing.id },
      data: { passwordHash, mustChangePassword: true },
    });

    res.json({ success: true, message: "Password reset successfully", data: { temporaryPassword } });
  } catch (err) {
    next(err);
  }
}

const statusValidators = [body("isActive").isBoolean().withMessage("isActive must be true or false.")];

async function setEmployeeStatus(req, res, next) {
  try {
    assertValid(req);
    const existing = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Employee not found.", "NOT_FOUND");

    const employee = await prisma.employee.update({
      where: { id: existing.id },
      data: { isActive: req.body.isActive },
    });

    res.json({ success: true, message: "Employee status updated", data: { employee: sanitizeEmployee(employee) } });
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

const employeeAttendanceHistoryValidators = [param("id").isString().isLength({ min: 1 })];

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

const updateProfileValidators = [
  body("name").optional().trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters."),
  body("designation").optional().trim(),
  body("email").optional().isEmail().withMessage("Valid email is required.").normalizeEmail(),
  body("profilePhoto").optional().trim(),
];

async function updateProfile(req, res, next) {
  try {
    assertValid(req);
    const data = {};
    if (req.body.name) data.name = req.body.name.trim();
    if (req.body.designation !== undefined) data.designation = req.body.designation.trim();
    if (req.body.email) {
      const newEmail = req.body.email.toLowerCase().trim();
      if (newEmail !== req.admin.email.toLowerCase()) {
        const existing = await prisma.admin.findFirst({
          where: { email: newEmail, NOT: { id: req.admin.id } },
        });
        if (existing) {
          throw new ApiError(409, "Email is already in use by another admin.", "EMAIL_IN_USE");
        }
        data.email = newEmail;
      }
    }
    if (req.body.profilePhoto !== undefined) {
      data.profilePhoto = req.body.profilePhoto;
    }
    const admin = await prisma.admin.update({ where: { id: req.admin.id }, data });
    res.json({ success: true, message: "Profile updated", data: { user: toPublicAdmin(admin) } });
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
    const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } });
    const valid = await comparePassword(req.body.currentPassword, admin.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Current password is incorrect.", "INVALID_CURRENT_PASSWORD");
    }
    const passwordHash = await hashPassword(req.body.newPassword);
    await prisma.admin.update({ where: { id: admin.id }, data: { passwordHash } });
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
    const admin = await prisma.admin.update({
      where: { id: req.admin.id },
      data: { profilePhoto: req.uploadedFilePath },
    });
    res.json({
      success: true,
      message: "Profile photo updated",
      data: { profilePhoto: admin.profilePhoto, user: toPublicAdmin(admin) },
    });
  } catch (err) {
    next(err);
  }
}

async function deleteProfilePhoto(req, res, next) {
  try {
    const admin = await prisma.admin.update({
      where: { id: req.admin.id },
      data: { profilePhoto: "" },
    });
    res.json({
      success: true,
      message: "Profile photo removed",
      data: { profilePhoto: "", user: toPublicAdmin(admin) },
    });
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
  deleteProfilePhoto,
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
