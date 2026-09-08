const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    profilePhoto: { type: String, default: "" },

    passkeyRegistered: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    role: { type: String, default: "employee", enum: ["employee"] },

    // Transient WebAuthn ceremony state (registration or authentication).
    // Cleared immediately after each verify step; never exposed via API.
    currentChallenge: { type: String, select: false },
    currentChallengeAt: { type: Date, select: false },
  },
  { timestamps: true }
);

employeeSchema.index({ department: 1 });
employeeSchema.index({ name: "text", email: "text", employeeId: "text" });

// `select: false` only filters query results -- a document returned by
// `.create()` still carries every field in memory. Stripping sensitive
// fields here too means res.json({ employee }) can never leak them,
// regardless of which code path produced the document.
function stripSensitiveFields(doc, ret) {
  delete ret.passwordHash;
  delete ret.currentChallenge;
  delete ret.currentChallengeAt;
  return ret;
}
employeeSchema.set("toJSON", { transform: stripSensitiveFields });
employeeSchema.set("toObject", { transform: stripSensitiveFields });

module.exports = mongoose.model("Employee", employeeSchema);
