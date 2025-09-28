const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  mobileNumber: { type: String, required: true },
  gstNumber: { type: String },
  city: { type: String, required: true },
  country: { type: String, required: true },
  createPassword: { type: String, required: true },
  confirmPassword: { type: String, required: true },

  // ✅ fields for forgot password
  resetOtp: { type: String },
  resetOtpExpiry: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
