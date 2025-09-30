const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  mobileNumber: { type: String, required: true },
  gstNumber: { type: String, required: false }, // optional if not mandatory
  city: { type: String, required: true },
  country: { type: String, required: true },
  createPassword: { type: String, required: true },
  confirmPassword: { type: String, required: true },
  otp: { type: String },
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  mobileNumber: { type: String, required: true },
  resetOtp: { type: String },                  // OTP as string
  resetOtpExpiry: { type: Date },              // Expiry time
  isOtpVerified: { type: Boolean, default: false }
 // still keeping OTP if you need it for verification
})

module.exports = mongoose.model("User", UserSchema);