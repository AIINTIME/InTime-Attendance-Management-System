require("dotenv").config();
const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");

async function seedVariety() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // 1. User3 (EMP03) - ON_TIME (Green dot)
    await Attendance.findByIdAndUpdate("6aa24aeef690c96966e96db7", {
      checkInTime: new Date("2026-09-10T03:55:00.000Z"), // 09:25 AM IST
      checkOutTime: new Date("2026-09-10T13:00:00.000Z"), // 06:30 PM IST
      latenessStatus: "ON_TIME",
      totalWorkingMinutes: 545,
      insufficientHours: false,
    });

    // 2. Demo (EMP01) - SLIGHT_LATE (Blue dot)
    await Attendance.findByIdAndUpdate("6aa23be4f690c96966e96b9d", {
      checkInTime: new Date("2026-09-10T04:04:00.000Z"), // 09:34 AM IST
      checkOutTime: new Date("2026-09-10T13:04:00.000Z"), // 06:34 PM IST
      latenessStatus: "SLIGHT_LATE",
      totalWorkingMinutes: 540,
      insufficientHours: false,
    });

    // 3. Soudip Panja (EMP02) 2026-09-10 - LATE (Orange dot)
    await Attendance.findByIdAndUpdate("6aa22f1966f9b46ebfb91951", {
      checkInTime: new Date("2026-09-10T04:12:00.000Z"), // 09:42 AM IST
      checkOutTime: new Date("2026-09-10T13:12:00.000Z"), // 06:42 PM IST
      latenessStatus: "LATE",
      totalWorkingMinutes: 540,
      insufficientHours: false,
    });

    // 4. Soudip Panja (EMP02) 2026-09-09 - VERY_LATE (Red dot)
    await Attendance.findByIdAndUpdate("6aa1417cebaee1df3026b780", {
      checkInTime: new Date("2026-09-09T09:22:00.000Z"), // 02:52 PM IST
      checkOutTime: new Date("2026-09-09T14:30:00.000Z"), // 08:00 PM IST
      latenessStatus: "VERY_LATE",
      totalWorkingMinutes: 308,
      insufficientHours: true,
    });

    console.log("Updated records in DB:");
    const records = await Attendance.find()
      .populate("employeeId", "name employeeId")
      .sort({ date: -1, checkInTime: 1 });

    records.forEach((r, idx) => {
      const timeStr = r.checkInTime.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      });
      console.log(
        `${idx + 1}. ${r.employeeId?.name} (${r.employeeId?.employeeId}) - Check-In: ${timeStr} IST - Status: ${r.latenessStatus}`
      );
    });

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (err) {
    console.error("Error updating attendance records:", err);
    process.exit(1);
  }
}

seedVariety();
