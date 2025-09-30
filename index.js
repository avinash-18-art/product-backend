const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const PDFDocument = require("pdfkit");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const otpGenerator = require("otp-generator");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = "apjabdulkalam@545";

app.use(cors({
  origin:"https://meesho-frontend-no7l.vercel.app",
  methods:['GET','POST','PUT','DELETE'],
  credentials:true, // If you need to send cookies or authentication headers with the request
})
);

// ===== Mongoose Connection =====
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB Atlas Connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ===== Models =====
const User = require("./models/User");

// ===== Middleware =====


app.use(express.json());
const upload = multer({ dest: "uploads/" });

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ===== Nodemailer Transporter =====
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ===== OTP Utility =====
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}


app.post("/signup", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      mobileNumber,
      gstNumber,
      city,
      country,
      createPassword,
      confirmPassword,
    } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !mobileNumber || !gstNumber || !city || !country || !createPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (createPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createPassword, 10);

    // Generate OTP
    const otp = generateOtp();

    // Twilio SMS
    try {
      await twilioClient.messages.create({
        body: `Your OTP is ${otp}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: mobileNumber.startsWith("+") ? mobileNumber : `+91${mobileNumber}`, // add country code if needed
      });
      console.log("OTP SMS sent");
    } catch (twilioError) {
      console.error("Twilio error:", twilioError.message);
    }

    // Nodemailer Email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your OTP Code",
        text: `Your OTP is ${otp}`,
      });
      console.log("OTP Email sent");
    } catch (emailError) {
      console.error("Nodemailer error:", emailError.message);
    }

    // Save user
    const newUser = new User({
      firstName,
      lastName,
      email,
      mobileNumber,
      gstNumber,
      city,
      country,
      createPassword: hashedPassword,
      confirmPassword:hashedPassword, // store hashed password only
      otp,
    });

    await newUser.save();

    res.status(201).json({ message: "Registration successful, OTP sent" });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
});



// ===== Forgot Password Route =====
app.post("/forgot-password", async (req, res) => {
  try {
    let { email, mobileNumber } = req.body;

    if (!email && !mobileNumber) {
      return res
        .status(400)
        .json({ message: "Email or Mobile required", success: false });
    }

    const query = [];

    if (email) {
      query.push({ email: email.toLowerCase().trim() });
    }

    if (mobileNumber) {
      // Normalize mobile number to include +91 if missing
      if (!mobileNumber.startsWith("+")) {
        mobileNumber = "+91" + mobileNumber.replace(/^0/, "");
      }
      query.push({ mobileNumber });
    }

    console.log("MongoDB query:", { $or: query });

    const user = await User.findOne({ $or: query });

    console.log("Found user:", user);

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetOtp = otp;
    user.resetOtpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    user.isOtpVerified = false;
    await user.save();

    // Send OTP via Email if email exists
    if (email) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Password Reset OTP",
        text: `Your OTP is ${otp}`,
      });
      console.log("OTP sent via email:", otp);
    }

    // Send OTP via SMS if mobile exists
    if (mobileNumber) {
      await twilioClient.messages.create({
        body: `Your password reset OTP is ${otp}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: user.mobileNumber,
      });
      console.log("OTP sent via SMS:", otp);
    }

    res.json({ message: "OTP sent successfully", success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    res
      .status(500)
      .json({ message: "Server error", success: false, error: error.message });
  }
});




app.post("/verify-otp", async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: "OTP required", success: false });

    const user = await User.findOne({
      resetOtp: otp.toString(),
      resetOtpExpiry: { $gt: Date.now() }
    });

    console.log("[DEBUG] Entered OTP:", otp);
    console.log("[DEBUG] User found:", user);

    if (!user)
      return res.status(400).json({ message: "Invalid or expired OTP", success: false });

    user.isOtpVerified = true;
    await user.save();

    console.log("[DEBUG] OTP verified for user:", user.email);

    res.json({ message: "OTP verified", success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message, success: false });
  }
});










// ===== Login =====
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ fullname: user.fullname, email: user.email, phoneNumber: user.phoneNumber }, JWT_SECRET, { expiresIn: "1h" });
    res.send({ message: "Login successful", token });

  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});



/* ================= RESEND OTP (Forgot Password) ================= */
app.post("/resend-otp", async (req, res) => {
  try {
    const { value } = req.body;
    const user = await User.findOne({
      $or: [{ email: value }, { mobileNumber: value }],
    });
    if (!user) return res.json({ message: "User not found", success: false });

    const otp = generateOtp();
    user.resetOtp = otp;
    user.resetOtpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    if (value.includes("@")) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Resent OTP",
        text: `Your OTP is ${otp}`,
      });
      console.log("Resent OTP via Email");
    } else {
      await twilioClient.messages.create({
        body: `Your OTP is ${otp}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: user.mobileNumber,
      });
      console.log("Resent OTP via SMS");
    }

    res.json({ message: "OTP resent successfully", success: true });
  } catch (error) {
    console.error("Resend OTP error:", error.message);
    res.status(500).json({ message: "Server error", success: false });
  }
});

/* ================= RESET PASSWORD ================= */
app.post("/reset-password", async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) 
      return res.status(400).json({ message: "Passwords required", success: false });

    if (newPassword !== confirmPassword) 
      return res.status(400).json({ message: "Passwords do not match", success: false });

    // Update password for all users (or you can specify a user ID if needed)
    // ⚠️ Be careful: without email or user identification, this updates everyone if multiple users exist
    const user = await User.findOne(); // Finds the first user
    if (!user) return res.status(404).json({ message: "No user found", success: false });

    user.createPassword = newPassword;
    user.confirmPassword = confirmPassword;

    await user.save();

    res.json({ message: "Password reset successful", success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message, success: false });
  }
});







// ===== Token Middleware =====
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ message: "Token required" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid token" });
    req.user = decoded;
    next();
  });
}

// ===== Profile Route =====
app.get("/profile", verifyToken, (req, res) => {
  res.send({ message: "Welcome to your profile", user: req.user });
});



let latestData = null;

// ===== Status list =====
const statusList = [
  "all",
  "rto",
  "door_step_exchanged",
  "delivered",
  "cancelled",
  "ready_to_ship",
  "shipped",
  "supplier_listed_price",
  "supplier_discounted_price",
];

// ===== Helpers =====
function parsePrice(value) {
  if (!value) return 0;
  const clean = value.toString().trim().replace(/[^0-9.\-]/g, "");
  return parseFloat(clean) || 0;
}

function getColumnValue(row, possibleNames) {
  const keys = Object.keys(row).map((k) => k.toLowerCase().trim());
  for (let name of possibleNames) {
    const idx = keys.indexOf(name.toLowerCase().trim());
    if (idx !== -1) return row[Object.keys(row)[idx]];
  }
  return 0;
}

function categorizeRows(rows) {
  const categories = {};
  statusList.forEach((status) => (categories[status] = []));
  categories.other = [];

  let totalSupplierListedPrice = 0;
  let totalSupplierDiscountedPrice = 0;
  let sellInMonthProducts = 0;
  let deliveredSupplierDiscountedPriceTotal = 0;
  let totalDoorStepExchanger = 0;

  rows.forEach((row) => {
    const status = (row["Reason for Credit Entry"] || "").toLowerCase().trim();
    categories["all"].push(row);

    const listedPrice = parsePrice(
      getColumnValue(row, [
        "Supplier Listed Price (Incl. GST + Commission)",
        "Supplier Listed Price",
        "Listed Price",
      ])
    );

    const discountedPrice = parsePrice(
      getColumnValue(row, [
        "Supplier Discounted Price (Incl GST and Commission)",
        "Supplier Discounted Price (Incl GST and Commision)",
        "Supplier Discounted Price",
        "Discounted Price",
      ])
    );

    totalSupplierListedPrice += listedPrice;
    totalSupplierDiscountedPrice += discountedPrice;

    if (status.includes("delivered")) {
      sellInMonthProducts += 1;
      deliveredSupplierDiscountedPriceTotal += discountedPrice;
    }

    if (status.includes("door_step_exchanged")) {
      totalDoorStepExchanger += 80;
    }

    let matched = false;
    if (
      status.includes("rto_complete") ||
      status.includes("rto_locked") ||
      status.includes("rto_initiated")
    ) {
      categories["rto"].push(row);
      matched = true;
    } else {
      statusList.forEach((s) => {
        if (s !== "all" && s !== "rto" && status.includes(s)) {
          categories[s].push(row);
          matched = true;
        }
      });
    }

    if (!matched) categories.other.push(row);
  });

  const totalProfit =
    deliveredSupplierDiscountedPriceTotal - sellInMonthProducts * 500;

  const profitPercent =
    sellInMonthProducts !== 0
      ? (totalProfit / (sellInMonthProducts * 500)) * 100
      : 0;

  categories.totals = {
    totalSupplierListedPrice,
    totalSupplierDiscountedPrice,
    sellInMonthProducts,
    deliveredSupplierDiscountedPriceTotal,
    totalDoorStepExchanger,
    totalProfit,
    profitPercent: profitPercent.toFixed(2),
  };

  return categories;
}

// ===== File upload =====
app.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

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
  } catch (error) {
    console.error("❌ Error processing file:", error);
    return res.status(500).json({ error: "Failed to process file" });
  }
});

// ===== Save Data (in-memory) =====
function saveData(rows, res) {
  if (!rows || !rows.length)
    return res.status(400).json({ message: "No data to save" });

  const categorized = categorizeRows(rows);

  // build profit by date
  const profitByDate = {};
  rows.forEach((row) => {
    const status = (row["Reason for Credit Entry"] || "").toLowerCase().trim();
    if (!status.includes("delivered")) return;

    const dateKey =
      row["Order Date"] ||
      row["Date"] ||
      row["Created At"] ||
      row["Delivered Date"];
    if (!dateKey) return;

    const date = new Date(dateKey).toISOString().split("T")[0];

    const discountedPrice = parsePrice(
      getColumnValue(row, [
        "Supplier Discounted Price (Incl GST and Commission)",
        "Supplier Discounted Price (Incl GST and Commision)",
        "Supplier Discounted Price",
        "Discounted Price",
      ])
    );

    if (!profitByDate[date]) {
      profitByDate[date] = { total: 0, count: 0 };
    }

    profitByDate[date].total += discountedPrice;
    profitByDate[date].count += 1;
  });

  const profitGraphArray = Object.keys(profitByDate).map((date) => {
    const { total, count } = profitByDate[date];
    return {
      date,
      profit: total - count * 500,
    };
  });

  latestData = {
    submittedAt: new Date(),
    data: rows,
    totals: categorized.totals,
    categories: categorized,
    profitByDate: profitGraphArray,
  };

  console.log("✅ Data stored in memory");
  return res.json({ ...categorized, profitByDate: profitGraphArray });
}

// ===== Profit Graph API =====
app.get("/profit-graph", (req, res) => {
  if (!latestData) return res.status(404).json({ error: "No data found" });
  res.json(latestData.profitByDate || []);
});

// ===== Filter API =====
app.get("/filter/:subOrderNo", (req, res) => {
  if (!latestData) return res.status(404).json({ error: "No data found" });

  const subOrderNo = req.params.subOrderNo.trim().toLowerCase();
  const rows = latestData.data;

  const match = rows.find((row) => {
    const keys = Object.keys(row).map((k) => k.toLowerCase());
    const subOrderKey = keys.find((k) => k.includes("sub") && k.includes("order"));
    if (
      subOrderKey &&
      row[subOrderKey] &&
      row[subOrderKey].toString().trim().toLowerCase() === subOrderNo
    ) {
      return true;
    }
    return Object.values(row).some(
      (v) => v && v.toString().trim().toLowerCase() === subOrderNo
    );
  });

  if (!match) return res.status(404).json({ error: "Sub Order No not found" });

  const listedPrice = parsePrice(
    getColumnValue(match, [
      "Supplier Listed Price (Incl. GST + Commission)",
      "Supplier Listed Price",
      "Listed Price",
    ])
  );

  const discountedPrice = parsePrice(
    getColumnValue(match, [
      "Supplier Discounted Price (Incl GST and Commission)",
      "Supplier Discounted Price (Incl GST and Commision)",
      "Supplier Discounted Price",
      "Discounted Price",
    ])
  );

  res.json({
    subOrderNo,
    listedPrice,
    discountedPrice,
    profit: 500 - discountedPrice,
  });
});

/* ===== PDF Helpers ===== */
function formatINR(n) {
  const num = Number(n) || 0;
  return "₹" + num.toLocaleString("en-IN");
}

function drawTable(doc, { headers, rows }, options = {}) {
  const {
    startX = 60,
    startY = 120,
    colWidths = [],
    rowHeight = 26,
    headerHeight = 28,
    maxY = doc.page.height - 60,
    headerFont = "Helvetica-Bold",
    rowFont = "Helvetica",
    fontSize = 10,
    cellPaddingX = 8,
  } = options;

  const cols = headers.length;
  const widths =
    colWidths.length === cols
      ? colWidths
      : Array(cols).fill(Math.floor((doc.page.width - startX * 2) / cols));

  let y = startY;

  function maybeAddPage(nextRowHeight) {
    if (y + nextRowHeight > maxY) {
      doc.addPage();
      y = 60; // top margin on new page
    }
  }

  // Header
  doc.font(headerFont).fontSize(fontSize);
  maybeAddPage(headerHeight);
  let x = startX;
  for (let c = 0; c < cols; c++) {
    doc.rect(x, y, widths[c], headerHeight).stroke();
    doc.text(String(headers[c]), x + cellPaddingX, y + 8, {
      width: widths[c] - cellPaddingX * 2,
      ellipsis: true,
    });
    x += widths[c];
  }
  y += headerHeight;

  // Rows
  doc.font(rowFont).fontSize(fontSize);
  rows.forEach((row) => {
    maybeAddPage(rowHeight);
    let x = startX;
    for (let c = 0; c < cols; c++) {
      doc.rect(x, y, widths[c], rowHeight).stroke();
      doc.text(String(row[c] ?? ""), x + cellPaddingX, y + 7, {
        width: widths[c] - cellPaddingX * 2,
        ellipsis: true,
      });
      x += widths[c];
    }
    y += rowHeight;
  });

  return y; // last Y position
}

// ===== PDF Download API =====
app.get("/download-pdf", (req, res) => {
  if (!latestData) return res.status(404).json({ error: "No data found" });

  const categorized = latestData.categories || {};
  const totals = latestData.totals || {};
  const profitByDate = Array.isArray(latestData.profitByDate)
    ? [...latestData.profitByDate]
    : [];

  // sort dates ascending
  profitByDate.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=dashboard-report.pdf"
  );

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  // Title
  doc.fontSize(18).font("Helvetica-Bold").text("📊 Dashboard Report", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(1.5);

  // ===== Metrics Table =====
  doc.font("Helvetica-Bold").fontSize(12).text("Summary Metrics");
  doc.moveDown(0.5);

  const tableTop = doc.y + 6;
  const cellHeight = 26;
  const col1X = 60;
  const col2X = 360;
  const col1Width = 300;
  const col2Width = 160;

  // Header row
  doc.rect(col1X, tableTop, col1Width, cellHeight).stroke();
  doc.rect(col2X, tableTop, col2Width, cellHeight).stroke();

  doc.font("Helvetica-Bold").fontSize(10).text("Metric", col1X + 8, tableTop + 8).text("Value", col2X + 8, tableTop + 8);

  const metrics = {
    "All Orders": (categorized.all || []).length || 0,
    "RTO": (categorized.rto || []).length || 0,
    "Door Step Exchanged": (categorized.door_step_exchanged || []).length || 0,
    "Delivered (count / discounted total)":
      `${totals?.sellInMonthProducts || 0} / ${formatINR(totals?.deliveredSupplierDiscountedPriceTotal || 0)}`,
    "Cancelled": (categorized.cancelled || []).length || 0,
    "Pending": (categorized.ready_to_ship || []).length || 0,
    "Shipped": (categorized.shipped || []).length || 0,
    "Other": (categorized.other || []).length || 0,
    "Supplier Listed Total Price": formatINR(totals?.totalSupplierListedPrice || 0),
    "Supplier Discounted Total Price": formatINR(totals?.totalSupplierDiscountedPrice || 0),
    "Total Profit": formatINR(totals?.totalProfit || 0),
    "Profit %": `${totals?.profitPercent || "0.00"}%`,
  };

  doc.font("Helvetica").fontSize(10);
  let y = tableTop + cellHeight;

  const bottomMargin = doc.page.height - 60;

  for (const [key, value] of Object.entries(metrics)) {
    if (y + cellHeight > bottomMargin) {
      doc.addPage();
      y = 60;
      doc.rect(col1X, y, col1Width, cellHeight).stroke();
      doc.rect(col2X, y, col2Width, cellHeight).stroke();
      doc.font("Helvetica-Bold").text("Metric", col1X + 8, y + 8).text("Value", col2X + 8, y + 8);
      y += cellHeight;
      doc.font("Helvetica");
    }

    doc.rect(col1X, y, col1Width, cellHeight).stroke();
    doc.rect(col2X, y, col2Width, cellHeight).stroke();

    doc.text(key, col1X + 8, y + 8, { width: col1Width - 16, ellipsis: true });
    doc.text(String(value), col2X + 8, y + 8, { width: col2Width - 16, ellipsis: true });

    y += cellHeight;
  }

  doc.moveDown(2);

  // ===== Profit By Date Table =====
  doc.font("Helvetica-Bold").fontSize(12).text("Profit By Date");
  doc.moveDown(0.5);

  const headers = ["Date", "Profit"];
  const rows = profitByDate.map((p) => [p.date, formatINR(p.profit || 0)]);
  const tableData = { headers, rows: rows.length ? rows : [["—", "—"]] };

  drawTable(doc, tableData, {
    startX: 60,
    startY: doc.y + 6,
    colWidths: [200, 140],
    rowHeight: 24,
    headerHeight: 26,
    maxY: doc.page.height - 60,
    fontSize: 10,
  });

  doc.end();
});

// ===== Start Server =====
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
