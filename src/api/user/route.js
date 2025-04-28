const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const User = require("../../models/User");

// ✅ Route: GET /api/user/me (Get logged in user's profile)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
