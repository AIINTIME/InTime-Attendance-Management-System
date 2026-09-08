const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, default: "admin", enum: ["admin"] },
    profilePhoto: { type: String, default: "" },
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// See Employee.js for why this transform is needed in addition to
// `select: false` -- a document from `.create()` isn't a query result.
function stripSensitiveFields(doc, ret) {
  delete ret.passwordHash;
  return ret;
}
adminSchema.set("toJSON", { transform: stripSensitiveFields });
adminSchema.set("toObject", { transform: stripSensitiveFields });

module.exports = mongoose.model("Admin", adminSchema);
