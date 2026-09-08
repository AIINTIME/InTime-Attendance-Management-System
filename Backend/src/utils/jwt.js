const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
};

function accessCookieOptions() {
  return { ...COOKIE_BASE_OPTIONS, maxAge: 15 * 60 * 1000 };
}

function refreshCookieOptions() {
  return { ...COOKIE_BASE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 };
}

const PASSKEY_TICKET_PURPOSE = "ATTENDANCE_PASSKEY_VERIFIED";

/**
 * Short-lived proof that an employee just completed a WebAuthn assertion,
 * so the attendance endpoints (a separate request) can require passkey
 * verification without re-running the ceremony inline (spec section 62).
 */
function signPasskeyTicket(employeeId) {
  return jwt.sign(
    { sub: employeeId, purpose: PASSKEY_TICKET_PURPOSE },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "2m" }
  );
}

function verifyPasskeyTicket(ticket, employeeId) {
  let payload;
  try {
    payload = jwt.verify(ticket, env.JWT_ACCESS_SECRET);
  } catch (err) {
    return false;
  }
  return payload.purpose === PASSKEY_TICKET_PURPOSE && payload.sub === employeeId;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  accessCookieOptions,
  refreshCookieOptions,
  signPasskeyTicket,
  verifyPasskeyTicket,
};
