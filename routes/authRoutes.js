const express = require("express");
const { signup, verifyOtp, login, getProfile } = require("../controllers/authController");
const verifyToken = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.get("/profile", verifyToken, getProfile);

module.exports = router;
