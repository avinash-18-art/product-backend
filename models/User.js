
const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  fullname: String,
  email: { type: String, unique: true },
  phoneNumber: String,
  otp: String,
  password: String
})

const User = mongoose.model('User', userSchema)
module.exports = User 
