// routes/connect/suggestions.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const User = require("../../models/User");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);

    // Suggest users not connected and not self
    const suggestions = await User.find({
      _id: { $ne: req.user.id, $nin: currentUser.connections }
    }).select("name course profilePicture enrollmentNumber");

    res.json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
