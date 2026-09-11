// Usage: npm run seed:admin
// Reads SEED_ADMIN_NAME / SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD from
// Backend/.env -- never hardcode production admin credentials here.
const env = require("../config/env");
const prisma = require("../config/prisma");
const { hashPassword } = require("../utils/password");

async function run() {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    console.error(
      "[seed:admin] Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in Backend/.env before running this script."
    );
    process.exit(1);
  }

  const existing = await prisma.admin.findUnique({ where: { email: env.SEED_ADMIN_EMAIL.toLowerCase() } });
  if (existing) {
    console.log(`[seed:admin] Admin already exists for ${env.SEED_ADMIN_EMAIL}. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  await prisma.admin.create({
    data: {
      name: env.SEED_ADMIN_NAME,
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      passwordHash,
    },
  });

  console.log(`[seed:admin] Created initial admin account: ${env.SEED_ADMIN_EMAIL}`);
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error("[seed:admin] Failed:", err);
  process.exit(1);
});
