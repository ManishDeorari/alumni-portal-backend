// routes/connect/sent.js
const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const Connect = require("../../models/Connect");
const User = require("../../models/User");

router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const sentConnections = await Connect.find({
      from: userId,
      status: "pending"
    }).populate("to", "name profilePicture course year batch");

    const sentUsers = sentConnections.map(conn => conn.to);

    res.status(200).json(sentUsers);
  } catch (err) {
    console.error("Error in GET /connect/sent:", err.stack);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
