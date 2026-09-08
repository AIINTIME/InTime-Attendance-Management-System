const express = require("express");
const reportController = require("../controllers/reportController");
const { requireAuth } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/attendance", reportController.reportValidators, reportController.previewReport);
router.get("/attendance/excel", reportController.reportValidators, reportController.exportExcel);
router.get("/attendance/pdf", reportController.reportValidators, reportController.exportPdf);

module.exports = router;
