const mongoose = require("mongoose");

const passkeyCredentialSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    credentialId: { type: String, required: true, unique: true },
    publicKey: { type: String, required: true }, // base64url-encoded COSE public key
    counter: { type: Number, required: true, default: 0 },
    transports: { type: [String], default: [] },
    deviceType: { type: String, default: "" }, // "singleDevice" | "multiDevice"
    backedUp: { type: Boolean, default: false },
    nickname: { type: String, default: "" }, // e.g. "iPhone", "Windows Laptop"
    lastUsedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PasskeyCredential", passkeyCredentialSchema);
