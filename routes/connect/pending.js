// routes/connect/pending.js

const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/authenticate");
const Connect = require("../../models/Connect");
const User = require("../../models/User");

router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all connection requests sent TO this user and not yet accepted
    const pendingConnections = await Connect.find({
      to: userId,
      status: "pending",
    }).populate("from", "-password");

    const pendingUsers = pendingConnections.map((conn) => conn.from);

    res.json(pendingUsers);
  } catch (err) {
    console.error("Error in /connect/pending:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
