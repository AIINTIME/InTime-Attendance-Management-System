const { body, validationResult } = require("express-validator");
const prisma = require("../config/prisma");
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
  body("countryCode").optional().trim(),
  body("profilePhoto").optional(),
];

async function updateMe(req, res, next) {
  try {
    assertValid(req);
    const { name, phone, countryCode, profilePhoto } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (countryCode !== undefined) data.countryCode = countryCode;
    if (profilePhoto !== undefined) data.profilePhoto = profilePhoto;

    const employee = await prisma.employee.update({ where: { id: req.employee.id }, data });
    res.json({ success: true, message: "Profile updated", data: { user: toPublicEmployee(employee) } });
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

    const employee = await prisma.employee.findUnique({ where: { id: req.employee.id } });
    const valid = await comparePassword(currentPassword, employee.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Current password is incorrect.", "INVALID_CURRENT_PASSWORD");
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.employee.update({
      where: { id: employee.id },
      data: { passwordHash, mustChangePassword: false },
    });

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
}

async function uploadProfilePhoto(req, res, next) {
  try {
    if (!req.uploadedFilePath && !req.uploadedDataUrl) {
      throw new ApiError(422, "A valid image file is required.", "NO_FILE");
    }

    const previousPhoto = req.employee.profilePhoto;
    const photoToStore = req.uploadedDataUrl || req.uploadedFilePath;
    const employee = await prisma.employee.update({
      where: { id: req.employee.id },
      data: { profilePhoto: photoToStore },
    });

    if (previousPhoto && previousPhoto.startsWith("/uploads/profile/")) {
      const previousPath = path.join(__dirname, "..", previousPhoto.replace("/uploads/", "uploads/"));
      fs.unlink(previousPath, () => {});
    }

    res.json({
      success: true,
      message: "Profile photo updated",
      data: { profilePhoto: employee.profilePhoto, user: toPublicEmployee(employee) },
    });
  } catch (err) {
    next(err);
  }
}

async function deleteProfilePhoto(req, res, next) {
  try {
    const currentPhoto = req.employee.profilePhoto;

    await prisma.employee.update({
      where: { id: req.employee.id },
      data: { profilePhoto: "" },
    });

    // Remove the file from disk
    if (currentPhoto && currentPhoto.startsWith("/uploads/profile/")) {
      const filePath = path.join(__dirname, "..", currentPhoto.replace("/uploads/", "uploads/"));
      fs.unlink(filePath, () => {});
    }

    res.json({
      success: true,
      message: "Profile photo removed",
      data: { profilePhoto: "" },
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
  deleteProfilePhoto,
};
