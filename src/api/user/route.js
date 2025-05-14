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

// ✅ Route: PUT /api/user/update (Update logged in user's profile)
router.put("/update", authMiddleware, async (req, res) => {
  try {
    const {
      name,
      bio,
      job,
      course,
      year,
      profilePicture // from Cloudinary
    } = req.body;

    const updatedFields = {
      ...(name && { name }),
      ...(bio && { bio }),
      ...(job && { job }),
      ...(course && { course }),
      ...(year && { year }),
      ...(profilePicture && { profilePicture })
    };

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updatedFields },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Profile updated", user: updatedUser });
  } catch (error) {
    console.error("Error updating profile:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
