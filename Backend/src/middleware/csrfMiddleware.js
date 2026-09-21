const crypto = require("crypto");
const env = require("../config/env");
const { ApiError } = require("./errorMiddleware");

const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const allowedOrigins = new Set([env.CLIENT_URL, ...env.WEBAUTHN_ORIGIN].filter(Boolean));

function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: env.ENFORCE_HTTPS,
    sameSite: env.ENFORCE_HTTPS ? "none" : "lax",
    path: "/",
  };
}

function clearCsrfCookieOptions() {
  return {
    secure: env.ENFORCE_HTTPS,
    sameSite: env.ENFORCE_HTTPS ? "none" : "lax",
    path: "/",
  };
}

function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString("base64url");
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions());
  return token;
}

function getRequestOrigin(req) {
  const origin = req.get("origin");
  if (origin) return origin;

  const referer = req.get("referer");
  if (!referer) return "";

  try {
    return new URL(referer).origin;
  } catch (err) {
    return "";
  }
}

function isLocalDevelopmentOrigin(origin) {
  if (env.ENFORCE_HTTPS) return false;

  try {
    const { protocol, hostname } = new URL(origin);
    if (!["http:", "https:"].includes(protocol)) return false;

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  } catch (err) {
    return false;
  }
}

function isAllowedOrigin(origin) {
  return allowedOrigins.has(origin) || isLocalDevelopmentOrigin(origin);
}

function tokensMatch(cookieToken, headerToken) {
  if (typeof cookieToken !== "string" || typeof headerToken !== "string") {
    return false;
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  return cookieBuffer.length === headerBuffer.length && crypto.timingSafeEqual(cookieBuffer, headerBuffer);
}

function hasAuthCookie(req) {
  return Boolean(req.cookies?.accessToken || req.cookies?.refreshToken);
}

function csrfProtection(req, res, next) {
  try {
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      issueCsrfToken(res);
    }

    if (SAFE_METHODS.has(req.method) || !hasAuthCookie(req)) {
      return next();
    }

    const requestOrigin = getRequestOrigin(req);
    if (!requestOrigin || !isAllowedOrigin(requestOrigin)) {
      throw new ApiError(403, "CSRF validation failed.", "CSRF_ORIGIN_INVALID");
    }

    const headerToken = req.get(CSRF_HEADER_NAME);
    if (!tokensMatch(req.cookies[CSRF_COOKIE_NAME], headerToken)) {
      throw new ApiError(403, "CSRF validation failed.", "CSRF_TOKEN_INVALID");
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  CSRF_COOKIE_NAME,
  csrfProtection,
  csrfCookieOptions,
  clearCsrfCookieOptions,
  issueCsrfToken,
};
