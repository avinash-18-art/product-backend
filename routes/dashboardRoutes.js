const express = require("express");
const router = express.Router();
const { getProfitGraph, downloadPDF } = require("../controllers/dashboardController");

router.get("/profit-graph", getProfitGraph);
router.get("/download-pdf", downloadPDF);

module.exports = router;
