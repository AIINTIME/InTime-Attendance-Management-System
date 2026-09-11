const express = require("express");
const attendanceController = require("../controllers/attendanceController");
const { requireAuth, requireEmployee } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth, requireEmployee);

router.post(
  "/office",
  attendanceController.officeAttendanceValidators,
  attendanceController.registerOffice
);
router.post(
  "/distance",
  attendanceController.distanceAttendanceValidators,
  attendanceController.registerDistance
);
router.post("/checkout", attendanceController.checkOutValidators, attendanceController.checkOut);
router.get("/my-records", attendanceController.myRecordsValidators, attendanceController.myRecords);
router.get("/today", attendanceController.today);
router.get("/working-days", attendanceController.workingDaysValidators, attendanceController.workingDays);

module.exports = router;
