const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { comparePassword } = require("../utils/password");
const { ApiError } = require("../middleware/errorMiddleware");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");
const { getCurrentAuthWeekKey, isAuthWeekValid } = require("../utils/authWeek");

function hashRefreshToken(refreshToken) {
  return crypto.createHash("sha256").update(refreshToken).digest("hex");
}

function getRefreshTokenExpiry(refreshToken) {
  const decoded = jwt.decode(refreshToken);
  if (!decoded?.exp) {
    throw new ApiError(500, "Refresh token expiry could not be determined.", "TOKEN_EXPIRY_MISSING");
  }
  return new Date(decoded.exp * 1000);
}

async function pruneExpiredSessions() {
  await prisma.authSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { not: null } },
      ],
    },
  });
}

async function createRefreshSession({ userId, role, authWeek }) {
  const tokenId = crypto.randomUUID();
  const payload = { sub: userId, role };
  if (authWeek) payload.authWeek = authWeek;

  const refreshToken = signRefreshToken(payload, tokenId);
  await prisma.authSession.create({
    data: {
      userId,
      role,
      tokenId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      authWeek: authWeek || null,
      expiresAt: getRefreshTokenExpiry(refreshToken),
    },
  });
  return refreshToken;
}

async function rotateRefreshSession(session, payload, previousTokenHash) {
  const refreshToken = signRefreshToken(
    {
      sub: payload.sub,
      role: payload.role,
      ...(payload.authWeek ? { authWeek: payload.authWeek } : {}),
    },
    session.tokenId
  );

  const result = await prisma.authSession.updateMany({
    where: {
      id: session.id,
      refreshTokenHash: previousTokenHash,
      revokedAt: null,
    },
    data: {
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: getRefreshTokenExpiry(refreshToken),
      lastUsedAt: new Date(),
    },
  });

  if (result.count !== 1) {
    await revokeUserSessions(payload.sub, payload.role);
    throw new ApiError(401, "Please log in again.", "REFRESH_TOKEN_REUSE_DETECTED");
  }

  return refreshToken;
}

async function revokeUserSessions(userId, role) {
  await prisma.authSession.updateMany({
    where: { userId, role, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function revokeRefreshSession(refreshTokenCookie) {
  if (!refreshTokenCookie) return;

  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenCookie);
  } catch (err) {
    return;
  }

  if (!payload?.jti) return;

  await prisma.authSession.updateMany({
    where: { tokenId: payload.jti, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function toPublicEmployee(employee) {
  return {
    id: employee.id,
    role: "employee",
    employeeId: employee.employeeId,
    name: employee.name,
    email: employee.email,
    department: employee.department,
    designation: employee.designation,
    profilePhoto: employee.profilePhoto,
    phone: employee.phone || "",
    countryCode: employee.countryCode || "+91",
    passkeyRegistered: employee.passkeyRegistered,
    mustChangePassword: employee.mustChangePassword,
  };
}

function toPublicAdmin(admin) {
  return {
    id: admin.id,
    role: "admin",
    name: admin.name,
    email: admin.email,
    designation: admin.designation || "senior hr",
    profilePhoto: admin.profilePhoto,
  };
}

async function loginEmployee(email, password) {
  const employee = await prisma.employee.findUnique({ where: { email: email.toLowerCase() } });
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

  const accessToken = signAccessToken({ sub: employee.id, role: "employee" });
  const refreshToken = await createRefreshSession({ userId: employee.id, role: "employee", authWeek });

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
  const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
  if (!admin) {
    throw new ApiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
  }

  const valid = await comparePassword(password, admin.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
  }

  const accessToken = signAccessToken({ sub: admin.id, role: "admin" });
  const refreshToken = await createRefreshSession({ userId: admin.id, role: "admin" });

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
  if (!payload.jti) {
    await revokeUserSessions(payload.sub, payload.role);
    throw new ApiError(401, "Please log in again.", "REFRESH_TOKEN_REVOKED");
  }

  await pruneExpiredSessions();
  const session = await prisma.authSession.findUnique({ where: { tokenId: payload.jti } });
  const tokenHash = hashRefreshToken(refreshTokenCookie);
  const invalidSession =
    !session ||
    session.userId !== payload.sub ||
    session.role !== payload.role ||
    session.revokedAt ||
    session.expiresAt <= new Date();

  if (invalidSession) {
    await revokeUserSessions(payload.sub, payload.role);
    throw new ApiError(401, "Please log in again.", "REFRESH_TOKEN_REVOKED");
  }

  if (session.refreshTokenHash !== tokenHash) {
    await revokeUserSessions(payload.sub, payload.role);
    throw new ApiError(401, "Please log in again.", "REFRESH_TOKEN_REUSE_DETECTED");
  }

  if (payload.role === "employee") {
    if (!isAuthWeekValid(payload.authWeek)) {
      await revokeUserSessions(payload.sub, payload.role);
      throw new ApiError(
        401,
        "Your weekly session has expired. Please log in again.",
        "REFRESH_TOKEN_EXPIRED_WEEK"
      );
    }

    const employee = await prisma.employee.findUnique({ where: { id: payload.sub } });
    if (!employee || !employee.isActive) {
      await revokeUserSessions(payload.sub, payload.role);
      throw new ApiError(401, "Please log in again.", "ACCOUNT_UNAVAILABLE");
    }

    const accessToken = signAccessToken({ sub: employee.id, role: "employee" });
    const refreshToken = await rotateRefreshSession(session, payload, tokenHash);

    return { accessToken, refreshToken, user: toPublicEmployee(employee) };
  }

  if (payload.role === "admin") {
    const admin = await prisma.admin.findUnique({ where: { id: payload.sub } });
    if (!admin) {
      await revokeUserSessions(payload.sub, payload.role);
      throw new ApiError(401, "Please log in again.", "ACCOUNT_UNAVAILABLE");
    }
    const accessToken = signAccessToken({ sub: admin.id, role: "admin" });
    const refreshToken = await rotateRefreshSession(session, payload, tokenHash);
    return { accessToken, refreshToken, user: toPublicAdmin(admin) };
  }

  throw new ApiError(401, "Please log in again.", "INVALID_TOKEN_ROLE");
}

module.exports = {
  loginEmployee,
  loginAdmin,
  refreshSession,
  revokeRefreshSession,
  revokeUserSessions,
  toPublicEmployee,
  toPublicAdmin,
};
