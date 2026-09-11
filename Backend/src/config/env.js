require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  return value;
}

const env = {
  NODE_ENV: required("NODE_ENV", "development"),
  // Not 5000 -- macOS reserves that for ControlCenter/AirPlay Receiver.
  // Not 5001 either -- too common a default, easy to collide with another
  // local project's server also bound to it.
  PORT: Number(required("PORT", 5055)),

  DATABASE_URL: required("DATABASE_URL", ""),

  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET", ""),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", ""),
  ACCESS_TOKEN_EXPIRES_IN: required("ACCESS_TOKEN_EXPIRES_IN", "15m"),
  REFRESH_TOKEN_EXPIRES_IN: required("REFRESH_TOKEN_EXPIRES_IN", "7d"),

  APP_TIMEZONE: required("APP_TIMEZONE", "Asia/Kolkata"),

  WEBAUTHN_RP_NAME: required("WEBAUTHN_RP_NAME", "InTime Attendance"),
  // Comma-separated lists are supported so the same backend can serve a
  // localhost dev origin AND a real HTTPS tunnel/domain (needed to test
  // passkeys from a real phone, since WebAuthn requires either "localhost"
  // or a secure HTTPS origin — a LAN IP over http:// will never work).
  WEBAUTHN_RP_ID: required("WEBAUTHN_RP_ID", "localhost")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  WEBAUTHN_ORIGIN: required("WEBAUTHN_ORIGIN", "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  CLIENT_URL: required("CLIENT_URL", "http://localhost:5173"),

  OFFICE_LATITUDE: Number(required("OFFICE_LATITUDE", 22.512507119278705)),
  OFFICE_LONGITUDE: Number(required("OFFICE_LONGITUDE", 88.39119924866769)),
  OFFICE_RADIUS_METERS: Number(required("OFFICE_RADIUS_METERS", 30)),

  OFFICE_START_TIME: required("OFFICE_START_TIME", "09:30"),
  OFFICE_END_TIME: required("OFFICE_END_TIME", "17:30"),
  SLIGHT_LATE_GRACE_MINUTES: Number(required("SLIGHT_LATE_GRACE_MINUTES", 15)),
  MIN_WORKING_HOURS: Number(required("MIN_WORKING_HOURS", 8)),

  SEED_ADMIN_NAME: required("SEED_ADMIN_NAME", "Super Admin"),
  SEED_ADMIN_EMAIL: required("SEED_ADMIN_EMAIL", ""),
  SEED_ADMIN_PASSWORD: required("SEED_ADMIN_PASSWORD", ""),
};

if (env.NODE_ENV !== "test") {
  const missing = [];
  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.JWT_ACCESS_SECRET) missing.push("JWT_ACCESS_SECRET");
  if (!env.JWT_REFRESH_SECRET) missing.push("JWT_REFRESH_SECRET");
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[env] Missing required environment variables: ${missing.join(", ")}. ` +
        "Copy Backend/.env.example to Backend/.env and fill in real values."
    );
  }
}

module.exports = env;
