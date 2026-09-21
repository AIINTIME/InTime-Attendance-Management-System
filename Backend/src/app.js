const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const path = require("path");

const env = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { apiLimiter } = require("./middleware/rateLimitMiddleware");
const { csrfProtection } = require("./middleware/csrfMiddleware");

const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const adminRoutes = require("./routes/adminRoutes");
const reportRoutes = require("./routes/reportRoutes");
const passkeyRoutes = require("./routes/passkeyRoutes");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const allowedOrigins = new Set([env.CLIENT_URL, ...env.WEBAUTHN_ORIGIN]);
function isLocalDevelopmentOrigin(origin) {
  if (env.ENFORCE_HTTPS) return false;

  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch (err) {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || isLocalDevelopmentOrigin(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(csrfProtection);

if (env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

app.use("/api", apiLimiter);

// See src/middleware/uploadMiddleware.js for why this path differs on
// Vercel (read-only filesystem outside /tmp).
const uploadsDir = process.env.VERCEL ? path.join("/tmp", "uploads") : path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "InTime Attendance API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/passkeys", passkeyRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
