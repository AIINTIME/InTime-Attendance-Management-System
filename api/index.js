// Vercel serverless entry point (must live at the repo-root /api for
// Vercel's zero-config Node function auto-detection to pick it up).
// Reuses the same Express app as the local dev server (Backend/src/app.js)
// -- Express apps are directly callable as (req, res) handlers, which is
// exactly what Vercel's Node runtime expects.
//
// Mongoose connections must be cached across invocations: a fresh
// `mongoose.connect()` on every cold-started function would be slow and
// can exhaust MongoDB Atlas's connection limit under concurrent traffic.
// `global` survives across invocations on a warm container, so we stash
// the in-flight connection promise there instead of reconnecting.
// Resolved as a relative path into Backend's own node_modules -- NOT a bare
// `require("mongoose")` -- so this is the exact same Mongoose singleton
// instance that Backend/src/models/*.js use internally (they resolve
// "mongoose" from within Backend/, walking up from there). Node's module
// cache is keyed by resolved file path, so as long as both requires hit the
// same file on disk, they share the same connection/model registry state.
// A bare require here would instead resolve to a *separate* copy hoisted
// into the repo root's own node_modules (needed so this file's own
// require("mongoose") works at all), silently connecting one instance
// while every actual query runs against a different, never-connected one --
// which is exactly what caused every query to buffer-timeout despite the
// connection itself succeeding.
const mongoose = require("../Backend/node_modules/mongoose");
const env = require("../Backend/src/config/env");
const app = require("../Backend/src/app");

async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) return;

  if (!global.__mongooseConnectPromise) {
    mongoose.set("strictQuery", true);
    // Mongoose queries issued before the connection is ready get queued
    // ("buffered") rather than failing outright, but only for this long --
    // a cold serverless container doing SRV DNS resolution + TLS handshake
    // against Atlas for the first time can genuinely take longer than the
    // 10s default, so give it more room here.
    mongoose.set("bufferTimeoutMS", 20000);

    console.log("[serverless] Connecting to MongoDB...");
    global.__mongooseConnectPromise = mongoose
      .connect(env.MONGODB_URI, {
        dbName: "InTimeAttendance",
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 5,
      })
      .then((conn) => {
        console.log("[serverless] MongoDB connected:", conn.connection.host);
        return conn;
      })
      .catch((err) => {
        console.error("[serverless] MongoDB connect() rejected:", err.message);
        global.__mongooseConnectPromise = null; // allow retry on next invocation
        throw err;
      });
  }

  await global.__mongooseConnectPromise;
}

module.exports = async (req, res) => {
  try {
    await ensureDbConnected();
  } catch (err) {
    console.error("[serverless] MongoDB connection failed:", err.message);
    res.status(500).json({
      success: false,
      message: "Database connection failed.",
      code: "DB_CONNECTION_ERROR",
    });
    return;
  }

  app(req, res);
};
