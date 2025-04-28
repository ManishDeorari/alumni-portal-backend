const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  enrollmentNumber: { type: String, unique: true },
  bio: String,
  job: String,
  location: String,
});

module.exports = mongoose.model("User", userSchema);
