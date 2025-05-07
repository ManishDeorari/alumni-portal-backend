const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");

// GET /api/user/me → own profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("❌ Error fetching user profile:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/user/update → update own profile
router.put("/update", authMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true }
    ).select("-password");
    res.json(updatedUser);
  } catch (error) {
    console.error("❌ Error updating profile:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/user/all → all alumni
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    console.error("❌ Error fetching users:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/user/connected → list of connected users
router.get("/connected", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("connections", "-password");
    res.json(user.connections || []);
  } catch (error) {
    console.error("❌ Error fetching connections:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/user/request/:id → send request
router.post("/request/:id", authMiddleware, async (req, res) => {
  try {
    const receiver = await User.findById(req.params.id);
    const sender = await User.findById(req.user.id);

    if (!receiver || !sender) return res.status(404).json({ message: "User not found" });

    if (
      receiver.pendingRequests.includes(sender._id) ||
      receiver.connections.includes(sender._id)
    ) {
      return res.status(400).json({ message: "Already requested or connected" });
    }

    receiver.pendingRequests.push(sender._id);
    sender.sentRequests.push(receiver._id);

    await receiver.save();
    await sender.save();

    res.json({ message: "Connection request sent" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/user/accept/:id → accept connection
router.post("/accept/:id", authMiddleware, async (req, res) => {
  try {
    const sender = await User.findById(req.params.id);
    const receiver = await User.findById(req.user.id);

    if (!sender || !receiver) return res.status(404).json({ message: "User not found" });

    if (!receiver.pendingRequests.includes(sender._id)) {
      return res.status(400).json({ message: "No such request" });
    }

    receiver.connections.push(sender._id);
    sender.connections.push(receiver._id);

    receiver.pendingRequests = receiver.pendingRequests.filter(
      (id) => id.toString() !== sender._id.toString()
    );
    sender.sentRequests = sender.sentRequests.filter(
      (id) => id.toString() !== receiver._id.toString()
    );

    await receiver.save();
    await sender.save();

    res.json({ message: "Connection accepted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/user/:id → public profile
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/user/points/add
router.patch("/points/add", authMiddleware, async (req, res) => {
  const { amount } = req.body;
  try {
    const user = await User.findById(req.user.id);

    const currentYear = new Date().getFullYear();
    if (user.lastResetYear < currentYear) {
      user.points = 0;
      user.lastResetYear = currentYear;
    }

    user.points += amount;
    await user.save();
    res.json({ points: user.points });
  } catch (error) {
    console.error("Error updating points:", error.message);
    res.status(500).json({ message: "Failed to update points" });
  }
});

// GET /api/user/award-eligible
router.get("/award-eligible", authMiddleware, async (req, res) => {
  try {
    const eligibleUsers = await User.find({ "points.total": { $gte: 80 } })
      .select("-password")
      .sort({ "points.total": -1 });

    res.json(eligibleUsers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching eligible users" });
  }
});


module.exports = router;
