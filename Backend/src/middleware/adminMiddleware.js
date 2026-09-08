// Role gate for admin-only routes. Kept as its own module (per project
// structure) even though it delegates to the shared auth middleware, so
// route files can express intent clearly: requireAuth, requireAdmin.
const { requireAdmin } = require("./authMiddleware");

module.exports = { requireAdmin };
