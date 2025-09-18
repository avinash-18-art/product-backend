const fs = require("fs");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");
const csv = require("csv-parser");
const { categorizeRows } = require("../utils/categorizeHelper");
const DataModel = require("../models/dataModel");

const uploadPath = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

const uploadFile = [
  upload.single("file"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();
    let rows = [];

    try {
      if (ext === ".csv") {
        fs.createReadStream(file.path)
          .pipe(csv())
          .on("data", (data) => rows.push(data))
          .on("end", () => {
            fs.unlinkSync(file.path);
            saveData(rows, res);
          });
      } else if (ext === ".xlsx" || ext === ".xls") {
        const workbook = XLSX.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        fs.unlinkSync(file.path);
        saveData(rows, res);
      } else {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: "Unsupported file format" });
      }
    } catch (err) {
      console.error("❌ Error processing file:", err);
      return res.status(500).json({ error: "Failed to process file" });
    }
  },
];

function saveData(rows, res) {
  if (!rows || !rows.length)
    return res.status(400).json({ message: "No data to save" });

  const categorized = categorizeRows(rows);

  const profitByDate = [];
  rows.forEach((row) => {
    const date = row["Order Date"] || row["Date"];
    if (!date) return;
    profitByDate.push({ date, profit: 0 }); // simplify
  });

  DataModel.setLatestData({
    submittedAt: new Date(),
    data: rows,
    categories: categorized,
    totals: categorized.totals,
    profitByDate,
  });

  res.json({ ...categorized, profitByDate });
}

module.exports = { uploadFile };
