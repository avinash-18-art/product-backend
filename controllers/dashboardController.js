const PDFDocument = require("pdfkit");
const DataModel = require("../models/dataModel");
const { formatINR, drawTable } = require("../utils/pdfHelper");

const getProfitGraph = (req, res) => {
  const latestData = DataModel.getLatestData();
  if (!latestData) return res.status(404).json({ error: "No data found" });
  res.json(latestData.profitByDate || []);
};

const downloadPDF = (req, res) => {
  const latestData = DataModel.getLatestData();
  if (!latestData) return res.status(404).json({ error: "No data found" });

  const { categories, totals, profitByDate } = latestData;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=dashboard-report.pdf");

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  doc.fontSize(18).font("Helvetica-Bold").text("📊 Dashboard Report", { align: "center" });
  doc.end();
};

module.exports = { getProfitGraph, downloadPDF };
