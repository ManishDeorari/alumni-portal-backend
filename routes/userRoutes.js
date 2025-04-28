const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware"); // ✅ Correct path
const User = require("../models/User");

// ✅ GET /api/user/me (Get own user profile)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("❌ Error fetching user profile:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ GET /api/user/all (Get all alumni for network page)
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    console.error("❌ Error fetching users:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ PUT /api/user/update (Update own profile)
router.put("/update", authMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true }
    ).select("-password");

    res.json(updatedUser);
  } catch (error) {
    console.error("❌ Error updating profile:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
