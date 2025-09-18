const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// ✅ Generate PDF
const generatePDF = (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const doc = new PDFDocument();
    const fileName = `output-${Date.now()}.pdf`;
    const filePath = path.join(__dirname, "../uploads", fileName);

    // Ensure uploads folder exists
    if (!fs.existsSync(path.join(__dirname, "../uploads"))) {
      fs.mkdirSync(path.join(__dirname, "../uploads"));
    }

    // Save PDF to server
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Write PDF content
    doc.fontSize(20).text(title, { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(content);
    doc.end();

    writeStream.on("finish", () => {
      res.json({ message: "PDF generated successfully", file: fileName });
    });
  } catch (error) {
    res.status(500).json({ error: "Error generating PDF", details: error.message });
  }
};

// ✅ Download PDF
const downloadPDF = (req, res) => {
  try {
    const { filename } = req.query;
    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    const filePath = path.join(__dirname, "../uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.download(filePath);
  } catch (error) {
    res.status(500).json({ error: "Error downloading PDF", details: error.message });
  }
};

module.exports = {
  generatePDF,
  downloadPDF,
};
