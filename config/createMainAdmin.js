const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function createMainAdmin() {
  try {
    const adminEmail = "manishdeorari377@gmail.com"; // You can change this
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log("✅ Main Admin already exists.");
      return;
    }

    // Hash password for security
    const hashedPassword = await bcrypt.hash("ManPri@2322", 10);

    // Create Main Admin user
    const mainAdmin = new User({
      name: "Main Admin",
      email: adminEmail,
      password: hashedPassword,
      role: "admin",         // special role
      isAdmin: true,         // gives access to admin routes
      approved: true,        // auto-approved
      employeeId: "EMP001",  // unique ID for main admin (like faculty)
    });

    await mainAdmin.save();
    console.log("🚀 Main Admin created successfully!");
  } catch (error) {
    console.error("❌ Error creating Main Admin:", error);
  }
}

module.exports = createMainAdmin;
