const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/authMiddleware");
const Connect = require("../../models/Connect");

// Either the sender or receiver can cancel/reject a pending request
router.post("/", authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const { from, to } = req.body;

    const request = await Connect.findOneAndDelete({
      $or: [
        { from: userId, to, status: "pending" },
        { from, to: userId, status: "pending" }
      ]
    });

    if (!request) {
      return res.status(404).json({ message: "Pending request not found" });
    }

    res.status(200).json({ message: "Request rejected or cancelled" });
  } catch (err) {
    console.error("Reject/Cancel Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
