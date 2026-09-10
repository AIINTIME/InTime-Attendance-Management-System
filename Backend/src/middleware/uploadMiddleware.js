const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const { ApiError } = require("./errorMiddleware");

// Vercel's serverless functions ship a read-only filesystem outside of
// /tmp, and even /tmp is wiped between cold starts / different container
// instances -- uploaded photos won't reliably persist there. This keeps
// uploads working (not crashing) on Vercel for a quick test deployment,
// but real persistence needs external object storage (S3, Vercel Blob,
// Cloudinary, etc.) wired in separately.
const UPLOAD_DIR = process.env.VERCEL
  ? path.join("/tmp", "uploads", "profile")
  : path.join(__dirname, "..", "uploads", "profile");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3MB

// Real magic-byte signatures so we never trust the client-supplied
// extension/mimetype alone (spec section 33).
const MAGIC_BYTES = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF", WEBP at offset 8
];

function detectRealMime(buffer) {
  for (const sig of MAGIC_BYTES) {
    if (sig.bytes.every((byte, i) => buffer[i] === byte)) {
      if (sig.mime === "image/webp") {
        const webpTag = buffer.slice(8, 12).toString("ascii");
        if (webpTag !== "WEBP") continue;
      }
      return sig.mime;
    }
  }
  return null;
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new ApiError(422, "Only JPG, PNG, or WEBP images are allowed.", "INVALID_FILE_TYPE"));
    }
    cb(null, true);
  },
});

/**
 * After multer has buffered the file in memory, verify magic bytes and
 * write it to disk with a random filename. Attaches req.uploadedFilePath
 * (relative, safe to store on the document) for the controller to use.
 */
function persistProfilePhoto(req, res, next) {
  try {
    if (!req.file) return next();

    const realMime = detectRealMime(req.file.buffer);
    if (!realMime || !ALLOWED_MIME_TYPES.has(realMime)) {
      throw new ApiError(422, "The uploaded file is not a valid image.", "INVALID_FILE_CONTENT");
    }

    const ext = realMime === "image/png" ? "png" : realMime === "image/webp" ? "webp" : "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const destPath = path.join(UPLOAD_DIR, filename);

    fs.writeFileSync(destPath, req.file.buffer);

    req.uploadedFilePath = `/uploads/profile/${filename}`;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, persistProfilePhoto };
