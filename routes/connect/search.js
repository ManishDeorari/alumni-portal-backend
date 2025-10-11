// routes/connect/search.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const User = require("../../models/User");

router.get("/", authMiddleware, async (req, res) => {
  const { query } = req.query; // ?query=abc

  try {
    const regex = new RegExp(query, "i"); // case-insensitive
    const currentUser = await User.findById(req.user.id);
    
    const users = await User.find({
      _id: { $ne: req.user.id }, // exclude self
      $or: [
        { name: regex },
        { email: regex },
        { enrollmentNumber: regex },
        { course: regex }
      ]
    }).select("name email enrollmentNumber course profilePicture connections");

    // mark already connected users
    const result = users.map((u) => ({
      ...u._doc,
      isConnected: currentUser.connections.includes(u._id),
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
