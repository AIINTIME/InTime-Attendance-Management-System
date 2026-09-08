const express = require("express");
const adminController = require("../controllers/adminController");
const { requireAuth } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/adminMiddleware");
const { upload, persistProfilePhoto } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/dashboard", adminController.getDashboard);

router.put("/profile", adminController.updateProfileValidators, adminController.updateProfile);
router.post(
  "/profile/change-password",
  adminController.changeOwnPasswordValidators,
  adminController.changeOwnPassword
);
router.post(
  "/profile/photo",
  upload.single("photo"),
  persistProfilePhoto,
  adminController.uploadProfilePhoto
);

router.get("/employees", adminController.listEmployeesValidators, adminController.listEmployees);
router.post("/employees", adminController.createEmployeeValidators, adminController.createEmployee);
router.get("/employees/:id", adminController.getEmployeeById);
router.put("/employees/:id", adminController.updateEmployeeValidators, adminController.updateEmployee);
router.post(
  "/employees/:id/reset-password",
  adminController.resetPasswordValidators,
  adminController.resetEmployeePassword
);
router.patch("/employees/:id/status", adminController.statusValidators, adminController.setEmployeeStatus);
router.get(
  "/employees/:id/attendance",
  adminController.employeeAttendanceHistoryValidators,
  adminController.getEmployeeAttendanceHistory
);

router.get("/attendance", adminController.listAttendanceValidators, adminController.listAttendance);

module.exports = router;
