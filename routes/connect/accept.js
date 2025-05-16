const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/authMiddleware");
const Connect = require("../../models/Connect");

router.post("/", authenticate, async (req, res) => {
  try {
    const to = req.user._id;
    const { from } = req.body;

    // Find the pending request
    const connection = await Connect.findOneAndUpdate(
      { from, to, status: "pending" },
      { status: "accepted" },
      { new: true }
    );

    if (!connection) {
      return res.status(404).json({ message: "No pending request found" });
    }

    res.status(200).json({ message: "Connection request accepted" });
  } catch (err) {
    console.error("Accept Request Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
