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
  try {
    const { amount, category = "total" } = req.body;
    console.log("📩 Incoming PATCH /points/add:", { amount, userId: req.user.id });

    if (typeof amount !== "number") {
      return res.status(400).json({ message: "Invalid 'amount' in request body" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.points) {
      user.points = {};  // initialize if not present
    }

    if (!user.points[category]) {
      user.points[category] = 0;
    }

    user.points[category] += amount;

    // Optionally recalculate total if category is not 'total'
    if (category !== "total") {
      user.points.total = Object.keys(user.points).reduce((sum, key) => {
        return key === "total" ? sum : sum + (user.points[key] || 0);
      }, 0);
    }

    await user.save();
    console.log(`✅ Points updated for ${user.name}:`, user.points);

    res.json({ message: "Points updated", points: user.points });
  } catch (error) {
    console.error("❌ Error in PATCH /points/add:", error.message);
    res.status(500).json({ message: "Server error while updating points" });
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
