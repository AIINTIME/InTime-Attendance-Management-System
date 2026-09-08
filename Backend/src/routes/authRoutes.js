const express = require("express");
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.post(
  "/employee/login",
  authLimiter,
  authController.employeeLoginValidators,
  authController.employeeLogin
);
router.post("/admin/login", authLimiter, authController.adminLoginValidators, authController.adminLogin);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);

module.exports = router;
