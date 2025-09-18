const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: "https://meesho-frontend-no7l.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
app.use(express.json());

// Routes
app.use("/auth", require("./routes/authRoutes"));
app.use("/file", require("./routes/fileRoutes"));
app.use("/pdf", require("./routes/pdfRoutes"));
app.use("/dashboard", require("./routes/dashboardRoutes"));





// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

