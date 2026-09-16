const env = require("../config/env");
const prisma = require("../config/prisma");
const { SETTINGS_KEY } = require("../services/settingsService");
const { hashPassword } = require("../utils/password");

async function generateNextEmployeeId() {
  const employees = await prisma.employee.findMany({
    where: { employeeId: { startsWith: "EMP" } },
    select: { employeeId: true },
  });
  let max = 0;
  for (const { employeeId } of employees) {
    const match = /^EMP(\d+)$/i.exec(employeeId);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val > max) max = val;
    }
  }
  return `EMP${String(max + 1).padStart(2, "0")}`;
}

async function seed() {
  console.log("[seed] Connecting to Postgres (Neon)...");
  await prisma.$connect();
  console.log("[seed] Connected");

  // 1. Seed or update Admin
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "tanuka@intimeinc.co.in").toLowerCase().trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "1234567890";
  const adminName = process.env.SEED_ADMIN_NAME || "Tanuka";
  const adminPasswordHash = await hashPassword(adminPassword);

  let admin = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (admin) {
    admin = await prisma.admin.update({
      where: { id: admin.id },
      data: { name: adminName, passwordHash: adminPasswordHash, mustChangePassword: false },
    });
    console.log(`[seed] Updated existing Admin in 'Admin' table: ${adminEmail}`);
  } else {
    admin = await prisma.admin.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: "admin",
        designation: "Senior HR",
        mustChangePassword: false,
      },
    });
    console.log(`[seed] Created new Admin in 'Admin' table: ${adminEmail}`);
  }

  // 2. Seed or update Employee
  const employeeEmail = (process.env.SEED_EMPLOYEE_EMAIL || "demo@intimeinc.co.in").toLowerCase().trim();
  const employeePassword = process.env.SEED_EMPLOYEE_PASSWORD || "1234567890";
  const employeeName = process.env.SEED_EMPLOYEE_NAME || "Demo Employee";
  const employeePasswordHash = await hashPassword(employeePassword);

  let employee = await prisma.employee.findUnique({ where: { email: employeeEmail } });
  if (employee) {
    employee = await prisma.employee.update({
      where: { id: employee.id },
      data: { name: employeeName, passwordHash: employeePasswordHash, mustChangePassword: false, isActive: true },
    });
    console.log(`[seed] Updated existing Employee in 'Employee' table: ${employeeEmail} (${employee.employeeId})`);
  } else {
    const nextEmployeeId = await generateNextEmployeeId();

    employee = await prisma.employee.create({
      data: {
        employeeId: nextEmployeeId,
        name: employeeName,
        email: employeeEmail,
        passwordHash: employeePasswordHash,
        department: "Engineering",
        designation: "Software Engineer",
        phone: "9876543210",
        role: "employee",
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log(`[seed] Created new Employee in 'Employee' table: ${employeeEmail} (${nextEmployeeId})`);
  }

  // 3. Ensure OrgSettings exists
  let settings = await prisma.orgSettings.findUnique({ where: { key: SETTINGS_KEY } });
  if (!settings) {
    settings = await prisma.orgSettings.create({
      data: {
        key: SETTINGS_KEY,
        officeAddress: "INTIME IT SERVICES PVT. LTD, Ruby Park East, Kasba, Kolkata, West Bengal 700078",
        officeLatitude: env.OFFICE_LATITUDE || 22.51238080138918,
        officeLongitude: env.OFFICE_LONGITUDE || 88.39112588370692,
        officeRadiusMeters: env.OFFICE_RADIUS_METERS || 100,
        checkInTime: env.OFFICE_START_TIME || "09:30",
        checkOutTime: env.OFFICE_END_TIME || "17:30",
        loginBufferMinutes: 2,
        slightLateGraceMinutes: 5,
        lateGraceMinutes: 15,
        veryLateGraceMinutes: 30,
        halfDayRules: [
          { dayOfWeek: 6, occurrence: 2 },
          { dayOfWeek: 6, occurrence: 4 },
        ],
      },
    });
    console.log("[seed] Initialized default OrgSettings");
  } else {
    console.log("[seed] OrgSettings already present");
  }

  console.log("\n[seed] SUCCESS! Database credentials summary:");
  console.log("--------------------------------------------------");
  console.log(`Admin   : ${admin.email} (Name: ${admin.name}, Role: ${admin.role})`);
  console.log(`Employee: ${employee.email} (ID: ${employee.employeeId}, Name: ${employee.name})`);
  console.log("--------------------------------------------------");

  await prisma.$disconnect();
  console.log("[seed] Disconnected");
}

seed().catch((err) => {
  console.error("[seed] Error:", err);
  process.exit(1);
});
