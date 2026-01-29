const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// ======================== SIGNUP ==========================
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, enrollmentNumber, employeeId, role } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    if (!["alumni", "faculty"].includes(role)) {
      return res.status(400).json({ message: "Invalid role — must be 'alumni' or 'faculty'" });
    }

    // Check for unique email
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(409).json({ message: "User already exists with this email" });

    // Alumni must have enrollment number
    if (role === "alumni" && !enrollmentNumber) {
      return res.status(400).json({ message: "Enrollment number is required for alumni" });
    }

    // Faculty must have employee ID
    if (role === "faculty" && !employeeId) {
      return res.status(400).json({ message: "Employee ID is required for faculty" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      enrollmentNumber: role === "alumni" ? enrollmentNumber : undefined,
      employeeId: role === "faculty" ? employeeId : undefined,
      isAdmin: false,
      approved: false,
    });

    await newUser.save();

    return res.status(201).json({
      message: "Signup successful! Please wait for admin approval.",
    });
  } catch (err) {
    console.error("❌ Signup error:", err.message);
    res.status(500).json({ message: "Server error during signup" });
  }
});

// ======================== LOGIN ==========================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("🔐 Login attempt:", { email });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    if (!user.approved && user.role !== "admin") {
      return res.status(403).json({ message: "Your account has not been approved by admin yet." });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, isAdmin: user.isAdmin },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        approved: user.approved,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Something went wrong during login" });
  }
});

const authMiddleware = require("../middleware/authMiddleware");

// ======================== RESET PASSWORD ==========================
router.post("/reset-password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user._id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid current password" });

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("❌ Reset password error:", err.message);
    res.status(500).json({ message: "Server error during password reset" });
  }
});

module.exports = router;
