const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const User = require("../models/User");

const secretKey = "apjabdulkalam@545";

// Signup
exports.signup = async (req, res) => {
  try {
    const { fullname, email, phoneNumber, password } = req.body;

    const existUser = await User.findOne({ email });
    if (existUser) return res.status(400).json({ message: "User already registered" });

    const hashPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Send OTP with Twilio
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    try {
      await twilioClient.messages.create({
        body: `Your OTP is ${otp}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: phoneNumber,
      });
    } catch (err) {
      console.error("Twilio error:", err.message);
    }

    // Send OTP with Nodemailer
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your OTP Code",
        text: `Your OTP is ${otp}`,
      });
    } catch (err) {
      console.error("Email error:", err.message);
    }

    const newUser = new User({ fullname, email, phoneNumber, otp, password: hashPassword });
    await newUser.save();

    res.json({ message: "Registration successful, OTP sent" });
  } catch (err) {
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.json({ message: "User not found", success: false });

  if (user.otp === otp) return res.json({ message: "OTP verified successfully", success: true });
  return res.json({ message: "Invalid OTP", success: false });
};

// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.json({ message: "User not found" });

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) return res.json({ message: "Invalid credentials" });

  const token = jwt.sign(
    { fullname: user.fullname, email: user.email, phoneNumber: user.phoneNumber },
    secretKey,
    { expiresIn: "1h" }
  );

  res.json({ message: "Login successful", token });
};

// Profile
exports.getProfile = (req, res) => {
  res.json({ message: "Welcome to profile", user: req.user });
};

