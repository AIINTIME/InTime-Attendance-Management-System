const Employee = require("../models/Employee");
const Admin = require("../models/Admin");
const { comparePassword } = require("../utils/password");
const { ApiError } = require("../middleware/errorMiddleware");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");
const { getCurrentAuthWeekKey, isAuthWeekValid } = require("../utils/authWeek");

function toPublicEmployee(employee) {
  return {
    id: employee._id,
    role: "employee",
    employeeId: employee.employeeId,
    name: employee.name,
    email: employee.email,
    department: employee.department,
    designation: employee.designation,
    profilePhoto: employee.profilePhoto,
    passkeyRegistered: employee.passkeyRegistered,
    mustChangePassword: employee.mustChangePassword,
  };
}

function toPublicAdmin(admin) {
  return {
    id: admin._id,
    role: "admin",
    name: admin.name,
    email: admin.email,
    profilePhoto: admin.profilePhoto,
  };
}

async function loginEmployee(email, password) {
  const employee = await Employee.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!employee) {
    throw new ApiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
  }
  if (!employee.isActive) {
    throw new ApiError(403, "This account has been deactivated. Contact your administrator.", "ACCOUNT_DISABLED");
  }

  const valid = await comparePassword(password, employee.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
  }

  // Every fresh login is stamped with the current calendar week (Mon-based);
  // the refresh token stays valid only within that same week (spec section 14).
  const authWeek = getCurrentAuthWeekKey(new Date()) || weekKeyEvenOnSunday();

  const accessToken = signAccessToken({ sub: employee._id.toString(), role: "employee" });
  const refreshToken = signRefreshToken({
    sub: employee._id.toString(),
    role: "employee",
    authWeek,
  });

  return { accessToken, refreshToken, user: toPublicEmployee(employee) };
}

// Sunday logins still need *some* authWeek value stamped on the token, even
// though that token will immediately fail isAuthWeekValid() until Monday
// arrives -- consistent with "Sunday is a non-working reset period".
function weekKeyEvenOnSunday() {
  // Re-derive using tomorrow's date so Sunday logins stamp the *upcoming*
  // week's Monday, matching the reset-day framing in the spec.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getCurrentAuthWeekKey(tomorrow);
}

async function loginAdmin(email, password) {
  const admin = await Admin.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!admin) {
    throw new ApiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
  }

  const valid = await comparePassword(password, admin.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
  }

  const accessToken = signAccessToken({ sub: admin._id.toString(), role: "admin" });
  const refreshToken = signRefreshToken({ sub: admin._id.toString(), role: "admin" });

  return { accessToken, refreshToken, user: toPublicAdmin(admin) };
}

async function refreshSession(refreshTokenCookie) {
  if (!refreshTokenCookie) {
    throw new ApiError(401, "Please log in again.", "NO_REFRESH_TOKEN");
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenCookie);
  } catch (err) {
    throw new ApiError(401, "Session expired. Please log in again.", "REFRESH_TOKEN_INVALID");
  }

  if (payload.role === "employee") {
    if (!isAuthWeekValid(payload.authWeek)) {
      throw new ApiError(
        401,
        "Your weekly session has expired. Please log in again.",
        "REFRESH_TOKEN_EXPIRED_WEEK"
      );
    }

    const employee = await Employee.findById(payload.sub);
    if (!employee || !employee.isActive) {
      throw new ApiError(401, "Please log in again.", "ACCOUNT_UNAVAILABLE");
    }

    const accessToken = signAccessToken({ sub: employee._id.toString(), role: "employee" });
    const refreshToken = signRefreshToken({
      sub: employee._id.toString(),
      role: "employee",
      authWeek: payload.authWeek,
    });

    return { accessToken, refreshToken, user: toPublicEmployee(employee) };
  }

  if (payload.role === "admin") {
    const admin = await Admin.findById(payload.sub);
    if (!admin) {
      throw new ApiError(401, "Please log in again.", "ACCOUNT_UNAVAILABLE");
    }
    const accessToken = signAccessToken({ sub: admin._id.toString(), role: "admin" });
    const refreshToken = signRefreshToken({ sub: admin._id.toString(), role: "admin" });
    return { accessToken, refreshToken, user: toPublicAdmin(admin) };
  }

  throw new ApiError(401, "Please log in again.", "INVALID_TOKEN_ROLE");
}

module.exports = { loginEmployee, loginAdmin, refreshSession, toPublicEmployee, toPublicAdmin };
