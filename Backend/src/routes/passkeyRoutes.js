const express = require("express");
const passkeyController = require("../controllers/passkeyController");
const { requireAuth, requireEmployee } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth, requireEmployee);

router.post("/register/options", passkeyController.registrationOptions);
router.post("/register/verify", passkeyController.registrationVerify);
router.post("/auth/options", passkeyController.authenticationOptions);
router.post("/auth/verify", passkeyController.authenticationVerify);
router.get("/", passkeyController.listCredentials);
router.delete("/:id", passkeyController.deleteCredential);

module.exports = router;
