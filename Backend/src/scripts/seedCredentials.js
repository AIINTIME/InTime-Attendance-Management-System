const mongoose = require("mongoose");
const env = require("../config/env");
const Admin = require("../models/Admin");
const Employee = require("../models/Employee");
const OrgSettings = require("../models/OrgSettings");
const { hashPassword } = require("../utils/password");

async function seed() {
  console.log("[seed] Connecting to MongoDB...");
  await mongoose.connect(env.MONGODB_URI, { dbName: "InTimeAttendance" });
  console.log(`[seed] Connected to MongoDB host: ${mongoose.connection.host}, database: InTimeAttendance`);

  // 1. Seed or update Admin
  const adminEmail = "tanuka@intimeinc.co.in".toLowerCase().trim();
  const adminPassword = "1234567890";
  const adminPasswordHash = await hashPassword(adminPassword);

  let admin = await Admin.findOne({ email: adminEmail });
  if (admin) {
    admin.passwordHash = adminPasswordHash;
    admin.mustChangePassword = false;
    await admin.save();
    console.log(`[seed] Updated existing Admin: ${adminEmail}`);
  } else {
    admin = await Admin.create({
      name: "Tanuka",
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: "admin",
      designation: "Senior HR",
      mustChangePassword: false,
    });
    console.log(`[seed] Created new Admin: ${adminEmail}`);
  }

  // 2. Seed or update Employee
  const employeeEmail = "demo@gmail.com".toLowerCase().trim();
  const employeePassword = "1234567890";
  const employeePasswordHash = await hashPassword(employeePassword);

  let employee = await Employee.findOne({ email: employeeEmail });
  if (employee) {
    employee.passwordHash = employeePasswordHash;
    employee.mustChangePassword = false;
    employee.isActive = true;
    await employee.save();
    console.log(`[seed] Updated existing Employee: ${employeeEmail} (${employee.employeeId})`);
  } else {
    // Determine next EMP ID
    const employees = await Employee.find({ employeeId: /^EMP\d+$/i }, { employeeId: 1 }).lean();
    let max = 0;
    for (const { employeeId } of employees) {
      const match = /^EMP(\d+)$/i.exec(employeeId);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > max) max = val;
      }
    }
    const nextEmployeeId = `EMP${String(max + 1).padStart(2, "0")}`;

    employee = await Employee.create({
      employeeId: nextEmployeeId,
      name: "Demo Employee",
      email: employeeEmail,
      passwordHash: employeePasswordHash,
      department: "Engineering",
      designation: "Software Engineer",
      phone: "9876543210",
      role: "employee",
      isActive: true,
      mustChangePassword: false,
    });
    console.log(`[seed] Created new Employee: ${employeeEmail} (${nextEmployeeId})`);
  }

  // 3. Ensure OrgSettings exists
  let settings = await OrgSettings.findOne({ key: OrgSettings.SETTINGS_KEY });
  if (!settings) {
    settings = await OrgSettings.create({
      key: OrgSettings.SETTINGS_KEY,
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
        { dayOfWeek: 6, occurrence: 1 },
        { dayOfWeek: 6, occurrence: 3 },
      ],
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

  await mongoose.disconnect();
  console.log("[seed] Disconnected from MongoDB");
}

seed().catch((err) => {
  console.error("[seed] Error:", err);
  process.exit(1);
});
