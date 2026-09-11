const { PrismaClient } = require("@prisma/client");

// Cached on `global` so a warm serverless container (or nodemon reload)
// reuses one client/connection pool instead of opening a fresh one per
// invocation -- Neon's pooled connection string still has a finite limit.
const prisma = global.__prisma || new PrismaClient();
global.__prisma = prisma;

module.exports = prisma;
