const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/authMiddleware");
const Connect = require("../../models/Connect");
const User = require("../../models/User");

// Receiver rejects a pending request
router.post("/", authenticate, async (req, res) => {
  try {
    const to = req.user._id;
    const { from } = req.body;

    const receiver = await User.findById(to);
    const sender = await User.findById(from);

    if (!receiver || !sender) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove from User arrays
    receiver.pendingRequests = receiver.pendingRequests.filter(id => id.toString() !== from.toString());
    sender.sentRequests = sender.sentRequests.filter(id => id.toString() !== to.toString());

    // Also remove from Connect model
    await Connect.findOneAndDelete({ from, to, status: "pending" });

    await receiver.save();
    await sender.save();

    res.status(200).json({ message: "Connection request rejected" });
  } catch (err) {
    console.error("Reject Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
