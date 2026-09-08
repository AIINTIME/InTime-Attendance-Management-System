const { body, validationResult } = require("express-validator");
const authService = require("../services/authService");
const { ApiError } = require("../middleware/errorMiddleware");
const { accessCookieOptions, refreshCookieOptions } = require("../utils/jwt");
const Employee = require("../models/Employee");
const Admin = require("../models/Admin");

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(422, errors.array()[0].msg, "VALIDATION_ERROR");
  }
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("accessToken", accessToken, accessCookieOptions());
  res.cookie("refreshToken", refreshToken, refreshCookieOptions());
}

function clearAuthCookies(res) {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });
}

const employeeLoginValidators = [
  body("email").isEmail().withMessage("A valid email is required.").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required."),
];

async function employeeLogin(req, res, next) {
  try {
    assertValid(req);
    const { email, password } = req.body;
    const { accessToken, refreshToken, user } = await authService.loginEmployee(email, password);
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ success: true, message: "Login successful", data: { user } });
  } catch (err) {
    next(err);
  }
}

const adminLoginValidators = [
  body("email").isEmail().withMessage("A valid email is required.").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required."),
];

async function adminLogin(req, res, next) {
  try {
    assertValid(req);
    const { email, password } = req.body;
    const { accessToken, refreshToken, user } = await authService.loginAdmin(email, password);
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ success: true, message: "Login successful", data: { user } });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { accessToken, refreshToken, user } = await authService.refreshSession(
      req.cookies?.refreshToken
    );
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ success: true, message: "Session refreshed", data: { user } });
  } catch (err) {
    clearAuthCookies(res);
    next(err);
  }
}

async function logout(req, res) {
  clearAuthCookies(res);
  res.json({ success: true, message: "Logged out" });
}

async function me(req, res, next) {
  try {
    if (req.user.role === "employee") {
      const employee = await Employee.findById(req.user.id);
      if (!employee) throw new ApiError(401, "Account not found.", "NOT_FOUND");
      return res.json({ success: true, message: "OK", data: { user: authService.toPublicEmployee(employee) } });
    }
    const admin = await Admin.findById(req.user.id);
    if (!admin) throw new ApiError(401, "Account not found.", "NOT_FOUND");
    res.json({ success: true, message: "OK", data: { user: authService.toPublicAdmin(admin) } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  employeeLoginValidators,
  adminLoginValidators,
  employeeLogin,
  adminLogin,
  refresh,
  logout,
  me,
};
