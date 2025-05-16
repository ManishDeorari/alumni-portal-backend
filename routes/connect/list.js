const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/authMiddleware");
const Connect = require("../../models/Connect");
const User = require("../../models/User");

router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    const connections = await Connect.find({
      $or: [{ from: userId }, { to: userId }],
      status: "accepted"
    }).lean();

    const connectedUserIds = connections.map(conn =>
      conn.from.toString() === userId.toString() ? conn.to : conn.from
    );

    const users = await User.find({ _id: { $in: connectedUserIds } }).select("fullName profilePic course batch");

    res.status(200).json(users);
  } catch (err) {
    console.error("Connection List Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
