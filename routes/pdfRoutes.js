const express = require("express");
const router = express.Router();
const pdfController = require("../controllers/pdfController");

router.post("/generate", pdfController.generatePDF);
router.get("/download", pdfController.downloadPDF);

module.exports = router;
