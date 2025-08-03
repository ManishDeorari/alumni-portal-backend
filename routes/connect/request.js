const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/authMiddleware");
const Connect = require("../../models/Connect");
const User = require("../../models/User");

router.post("/", authenticate, async (req, res) => {
  try {
    const from = req.user._id;
    const { to } = req.body;

    if (from.toString() === to) {
      return res.status(400).json({ message: "You cannot connect with yourself" });
    }

    // Check if request already exists (pending or accepted)
    const existing = await Connect.findOne({
      $or: [
        { from, to },
        { from: to, to: from }
      ],
      status: { $in: ["pending", "accepted"] },
    });

    if (existing) {
      return res.status(400).json({ message: "Request already exists or already connected" });
    }

    const connection = new Connect({ from, to });
    await connection.save();

    // Send notification to recipient
    const sender = await User.findById(from);
    await User.findByIdAndUpdate(to, {
      $push: {
        notifications: {
          type: "connect",
          message: `${sender.name} sent you a connection request`,
          from: from
        }
      }
    });

    res.status(201).json({ message: "Connection request sent successfully" });
  } catch (err) {
    console.error("Send Request Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
