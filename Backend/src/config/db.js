const prisma = require("./prisma");

async function connectDB() {
  try {
    await prisma.$connect();
    console.log("[db] Connected to Postgres (Neon)");
  } catch (err) {
    console.error(`[db] Database connection failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = connectDB;
