const { verifyAccessToken } = require("../utils/jwt");
const { ApiError } = require("./errorMiddleware");
const prisma = require("../config/prisma");

/**
 * Requires a valid access-token cookie. Populates req.user = { id, role }.
 * Does not itself distinguish employee vs admin routes — see
 * requireEmployee / requireAdmin below.
 */
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.accessToken;
    if (!token) {
      throw new ApiError(401, "Please log in to continue.", "NO_TOKEN");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      throw new ApiError(401, "Session expired. Please log in again.", "TOKEN_EXPIRED");
    }

    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
}

async function requireEmployee(req, res, next) {
  try {
    if (!req.user || req.user.role !== "employee") {
      throw new ApiError(403, "Employee access only.", "FORBIDDEN");
    }
    const employee = await prisma.employee.findUnique({ where: { id: req.user.id } });
    if (!employee) {
      throw new ApiError(401, "Account not found.", "NOT_FOUND");
    }
    if (!employee.isActive) {
      throw new ApiError(403, "This account has been deactivated.", "ACCOUNT_DISABLED");
    }
    req.employee = employee;
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAdmin(req, res, next) {
  try {
    if (!req.user || req.user.role !== "admin") {
      throw new ApiError(403, "Admin access only.", "FORBIDDEN");
    }
    const admin = await prisma.admin.findUnique({ where: { id: req.user.id } });
    if (!admin) {
      throw new ApiError(401, "Account not found.", "NOT_FOUND");
    }
    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, requireEmployee, requireAdmin };
