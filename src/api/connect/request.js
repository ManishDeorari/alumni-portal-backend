// routes/connect.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const User = require("../../models/User");

router.post("/request", authMiddleware, async (req, res) => {
  const { toUserId } = req.body;

  try {
    const fromUser = await User.findById(req.user.id);
    const toUser = await User.findById(toUserId);

    if (!toUser) return res.status(404).json({ message: "User not found" });

    // Avoid duplicates
    if (toUser.connectionRequests.includes(fromUser._id)) {
      return res.status(400).json({ message: "Request already sent" });
    }

    toUser.connectionRequests.push(fromUser._id);
    await toUser.save();

    res.json({ message: "Connection request sent" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
