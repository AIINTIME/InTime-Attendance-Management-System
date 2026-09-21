require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  return value;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function parseOriginList(value) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isLocalOrigin(origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch (err) {
    return false;
  }
}

function isHttpsOrigin(origin) {
  try {
    return new URL(origin).protocol === "https:";
  } catch (err) {
    return false;
  }
}

function isPlaceholderSecret(value) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("change-me") ||
    normalized.includes("changeme") ||
    normalized.includes("replace-me") ||
    normalized.includes("your-secret") ||
    normalized.includes("secret-key") ||
    normalized === "secret" ||
    normalized === "password"
  );
}

function validateEnv(env) {
  if (env.NODE_ENV === "test") return;

  const errors = [];
  const missing = [];

  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.JWT_ACCESS_SECRET) missing.push("JWT_ACCESS_SECRET");
  if (!env.JWT_REFRESH_SECRET) missing.push("JWT_REFRESH_SECRET");

  if (missing.length) {
    errors.push(`Missing required environment variables: ${missing.join(", ")}.`);
  }

  const jwtSecrets = [
    ["JWT_ACCESS_SECRET", env.JWT_ACCESS_SECRET],
    ["JWT_REFRESH_SECRET", env.JWT_REFRESH_SECRET],
  ];

  for (const [name, value] of jwtSecrets) {
    if (!value) continue;
    if (value.length < 32) {
      errors.push(`${name} must be at least 32 characters long.`);
    }
    if (isPlaceholderSecret(value)) {
      errors.push(`${name} appears to be a placeholder value.`);
    }
  }

  if (env.JWT_ACCESS_SECRET && env.JWT_REFRESH_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.");
  }

  if (env.ENFORCE_HTTPS) {
    const insecureOrigins = [env.CLIENT_URL, ...env.WEBAUTHN_ORIGIN].filter(
      (origin) => !isHttpsOrigin(origin)
    );

    if (insecureOrigins.length) {
      errors.push(
        `ENFORCE_HTTPS requires https:// CLIENT_URL and WEBAUTHN_ORIGIN values. Insecure: ${insecureOrigins.join(", ")}.`
      );
    }
  } else if (env.NODE_ENV === "production") {
    errors.push("NODE_ENV=production requires ENFORCE_HTTPS=true.");
  } else {
    const nonLocalHttpOrigins = [env.CLIENT_URL, ...env.WEBAUTHN_ORIGIN].filter(
      (origin) => origin.startsWith("http://") && !isLocalOrigin(origin)
    );

    if (nonLocalHttpOrigins.length) {
      errors.push(
        `Non-local shared origins must use HTTPS and ENFORCE_HTTPS=true. Insecure: ${nonLocalHttpOrigins.join(", ")}.`
      );
    }
  }

  if (errors.length) {
    throw new Error(
      `[env] Invalid backend environment:\n- ${errors.join("\n- ")}\n` +
        "Copy Backend/.env.example to Backend/.env and fill in production-grade values."
    );
  }
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
  WEBAUTHN_ORIGIN: parseOriginList(required("WEBAUTHN_ORIGIN", "http://localhost:5173")),

  CLIENT_URL: required("CLIENT_URL", "http://localhost:5173"),
  ENFORCE_HTTPS: parseBoolean(process.env.ENFORCE_HTTPS, process.env.NODE_ENV === "production"),

  OFFICE_LATITUDE: Number(required("OFFICE_LATITUDE", 22.512507119278705)),
  OFFICE_LONGITUDE: Number(required("OFFICE_LONGITUDE", 88.39119924866769)),
  OFFICE_RADIUS_METERS: Number(required("OFFICE_RADIUS_METERS", 30)),

  OFFICE_START_TIME: required("OFFICE_START_TIME", "09:30"),
  OFFICE_END_TIME: required("OFFICE_END_TIME", "17:30"),
  SLIGHT_LATE_GRACE_MINUTES: Number(required("SLIGHT_LATE_GRACE_MINUTES", 15)),
  MIN_WORKING_HOURS: Number(required("MIN_WORKING_HOURS", 8)),
};

validateEnv(env);

module.exports = env;
