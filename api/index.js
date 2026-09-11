// Vercel serverless entry point (must live at the repo-root /api for
// Vercel's zero-config Node function auto-detection to pick it up).
// Reuses the same Express app as the local dev server (Backend/src/app.js)
// -- Express apps are directly callable as (req, res) handlers, which is
// exactly what Vercel's Node runtime expects. Backend/src/config/prisma.js
// caches its PrismaClient on `global`, so it's reused across invocations on
// a warm container instead of opening a fresh connection pool every time.
const app = require("../Backend/src/app");

module.exports = app;
