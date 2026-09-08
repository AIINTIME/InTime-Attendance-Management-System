const express = require("express");
const employeeController = require("../controllers/employeeController");
const { requireAuth, requireEmployee } = require("../middleware/authMiddleware");
const { upload, persistProfilePhoto } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(requireAuth, requireEmployee);

router.get("/me", employeeController.getMe);
router.put("/me", employeeController.updateMeValidators, employeeController.updateMe);
router.post(
  "/me/change-password",
  employeeController.changePasswordValidators,
  employeeController.changePassword
);
router.post(
  "/me/profile-photo",
  upload.single("photo"),
  persistProfilePhoto,
  employeeController.uploadProfilePhoto
);

module.exports = router;
