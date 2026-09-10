const { body, validationResult } = require("express-validator");
const Employee = require("../models/Employee");
const { ApiError } = require("../middleware/errorMiddleware");
const { hashPassword, comparePassword } = require("../utils/password");
const { toPublicEmployee } = require("../services/authService");
const fs = require("fs");
const path = require("path");

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(422, errors.array()[0].msg, "VALIDATION_ERROR");
  }
}

async function getMe(req, res) {
  res.json({ success: true, message: "OK", data: { user: toPublicEmployee(req.employee) } });
}

const updateMeValidators = [
  body("name").optional().trim().isLength({ min: 2 }).withMessage("Name is too short."),
  body("phone").optional().trim(),
  body("dateOfBirth").optional().isISO8601().toDate().withMessage("Invalid date format."),
  body("gender").optional().isIn(["Male", "Female", "Other", ""]).withMessage("Invalid gender."),
];

async function updateMe(req, res, next) {
  try {
    assertValid(req);
    const { name, phone, dateOfBirth, gender } = req.body;
    if (name !== undefined) req.employee.name = name;
    if (phone !== undefined) req.employee.phone = phone;
    if (dateOfBirth !== undefined) req.employee.dateOfBirth = dateOfBirth;
    if (gender !== undefined) req.employee.gender = gender;
    await req.employee.save();
    res.json({ success: true, message: "Profile updated", data: { user: toPublicEmployee(req.employee) } });
  } catch (err) {
    next(err);
  }
}

const changePasswordValidators = [
  body("currentPassword").notEmpty().withMessage("Current password is required."),
  body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 characters."),
  body("confirmNewPassword").custom((value, { req }) => value === req.body.newPassword).withMessage(
    "Passwords do not match."
  ),
];

async function changePassword(req, res, next) {
  try {
    assertValid(req);
    const { currentPassword, newPassword } = req.body;

    const employee = await Employee.findById(req.employee._id).select("+passwordHash");
    const valid = await comparePassword(currentPassword, employee.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Current password is incorrect.", "INVALID_CURRENT_PASSWORD");
    }

    employee.passwordHash = await hashPassword(newPassword);
    employee.mustChangePassword = false;
    await employee.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
}

async function uploadProfilePhoto(req, res, next) {
  try {
    if (!req.uploadedFilePath) {
      throw new ApiError(422, "A valid image file is required.", "NO_FILE");
    }

    const previousPhoto = req.employee.profilePhoto;
    req.employee.profilePhoto = req.uploadedFilePath;
    await req.employee.save();

    if (previousPhoto && previousPhoto.startsWith("/uploads/profile/")) {
      const previousPath = path.join(__dirname, "..", previousPhoto.replace("/uploads/", "uploads/"));
      fs.unlink(previousPath, () => {});
    }

    res.json({
      success: true,
      message: "Profile photo updated",
      data: { profilePhoto: req.employee.profilePhoto },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  updateMeValidators,
  changePasswordValidators,
  getMe,
  updateMe,
  changePassword,
  uploadProfilePhoto,
};
