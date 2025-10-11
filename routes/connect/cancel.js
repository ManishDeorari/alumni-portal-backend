// routes/connect/cancel.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const User = require("../../models/User");

router.post("/cancel", authMiddleware, async (req, res) => {
  const { toUserId } = req.body;

  try {
    const currentUser = await User.findById(req.user.id);
    const toUser = await User.findById(toUserId);

    if (!toUser) return res.status(404).json({ message: "User not found" });

    // Remove from currentUser.sentRequests
    currentUser.sentRequests = currentUser.sentRequests.filter(
      (id) => id.toString() !== toUserId
    );

    // Remove from toUser.pendingRequests
    toUser.pendingRequests = toUser.pendingRequests.filter(
      (id) => id.toString() !== currentUser._id.toString()
    );

    await currentUser.save();
    await toUser.save();

    res.json({ message: "Request canceled" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
