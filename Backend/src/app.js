const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const path = require("path");

const env = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { apiLimiter } = require("./middleware/rateLimitMiddleware");

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
// Requests normally reach the backend only through the Vite dev proxy
// (same-origin from the browser's point of view), but the proxy forwards
// the original Origin header, so CORS still sees whatever host served the
// page -- localhost, a LAN IP (npm run dev -- --host, different every
// network), or a tunnel domain. The LAN IP can't be listed in advance, so
// non-production reflects any origin; production keeps the strict list.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.NODE_ENV !== "production" || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

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
