const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/authMiddleware");
const Connect = require("../../models/Connect");
const User = require("../../models/User");

router.post("/", authenticate, async (req, res) => {
  try {
    const to = req.user._id;
    const { from } = req.body;

    const receiver = await User.findById(to);
    const sender = await User.findById(from);

    if (!receiver || !sender) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the pending request in Connect model
    const connection = await Connect.findOneAndUpdate(
      { from, to, status: "pending" },
      { status: "accepted" },
      { new: true }
    );

    if (!connection) {
      // Logic fallback: check if it's already in pendingRequests array even if Connect doc missing
      const pendStr = (receiver.pendingRequests || []).map(id => id.toString());
      if (!pendStr.includes(from)) {
        return res.status(404).json({ message: "No pending request found" });
      }
    }

    // Update User arrays
    receiver.pendingRequests = (receiver.pendingRequests || []).filter(id => id.toString() !== from);
    sender.sentRequests = (sender.sentRequests || []).filter(id => id.toString() !== to.toString());

    const myConnStr = (receiver.connections || []).map(id => id.toString());
    const senderConnStr = (sender.connections || []).map(id => id.toString());

    if (!myConnStr.includes(from)) receiver.connections.push(from);
    if (!senderConnStr.includes(to.toString())) sender.connections.push(to);

    // Notification
    sender.notifications.push({
      type: "connect_accept",
      message: `${receiver.name} accepted your connection request`,
      from: to
    });

    await receiver.save();
    await sender.save();

    res.status(200).json({ message: "Connection request accepted" });
  } catch (err) {
    console.error("Accept Request Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
