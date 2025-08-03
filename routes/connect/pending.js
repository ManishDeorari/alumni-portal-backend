// routes/connect/pending.js

const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware"); // Correct relative path
const Connect = require("../../models/Connect");
const User = require("../../models/User");

router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all connection requests sent TO this user and not yet accepted
    const pendingConnections = await Connect.find({
      to: userId,
      status: "pending",
    }).populate("from", "fullName email profilePic"); // populate selected safe fields only

    const pendingUsers = pendingConnections.map((conn) => conn.from);

    res.status(200).json(pendingUsers);
  } catch (err) {
    console.error("Error in GET /connect/pending:", err.stack);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
