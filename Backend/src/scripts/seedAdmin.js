// Usage: npm run seed:admin
// Reads SEED_ADMIN_NAME / SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD from
// Backend/.env -- never hardcode production admin credentials here.
const mongoose = require("mongoose");
const env = require("../config/env");
const Admin = require("../models/Admin");
const { hashPassword } = require("../utils/password");

async function run() {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    console.error(
      "[seed:admin] Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in Backend/.env before running this script."
    );
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI, { dbName: "InTimeAttendance" });
  console.log("[seed:admin] Connected to MongoDB");

  const existing = await Admin.findOne({ email: env.SEED_ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    console.log(`[seed:admin] Admin already exists for ${env.SEED_ADMIN_EMAIL}. Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  await Admin.create({
    name: env.SEED_ADMIN_NAME,
    email: env.SEED_ADMIN_EMAIL.toLowerCase(),
    passwordHash,
  });

  console.log(`[seed:admin] Created initial admin account: ${env.SEED_ADMIN_EMAIL}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[seed:admin] Failed:", err);
  process.exit(1);
});
