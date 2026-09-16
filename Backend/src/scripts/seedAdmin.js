// Usage: npm run seed:admin
// Reads SEED_ADMIN_NAME / SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD from
// Backend/.env -- never hardcode production admin credentials here.
const env = require("../config/env");
const prisma = require("../config/prisma");
const { hashPassword } = require("../utils/password");

async function run() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME || env.SEED_ADMIN_NAME || "Super Admin";

  if (!adminEmail || !adminPassword) {
    console.error(
      "[seed:admin] Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in environment before running this script."
    );
    process.exit(1);
  }

  const existing = await prisma.admin.findUnique({ where: { email: adminEmail.toLowerCase() } });
  if (existing) {
    console.log(`[seed:admin] Admin already exists for ${adminEmail}. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await hashPassword(adminPassword);
  await prisma.admin.create({
    data: {
      name: adminName,
      email: adminEmail.toLowerCase(),
      passwordHash,
    },
  });

  console.log(`[seed:admin] Created initial admin account: ${adminEmail}`);
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error("[seed:admin] Failed:", err);
  process.exit(1);
});
