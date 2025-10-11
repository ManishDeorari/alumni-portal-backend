const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authenticate = require("../middleware/authMiddleware");

// ✅ Middleware to check admin access
const verifyAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: "Server error verifying admin." });
  }
};

// ✅ 1️⃣ Get all pending users (faculty/alumni waiting for approval)
router.get("/pending-users", authenticate, verifyAdmin, async (req, res) => {
  try {
    const pendingUsers = await User.find({
      approved: false,
      role: { $in: ["faculty", "alumni"] },
    }).select("-password");
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pending users" });
  }
});

// ✅ 2️⃣ Approve a specific user
router.put("/approve/:id", authenticate, verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json({ message: "User not found" });

    user.approved = true;
    await user.save();

    res.json({ message: `${user.name} has been approved successfully!` });
  } catch (error) {
    res.status(500).json({ message: "Failed to approve user" });
  }
});

// ✅ 3️⃣ Promote a faculty to Admin
router.put("/make-admin/:id", authenticate, verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role !== "faculty") {
      return res.status(400).json({ message: "Only faculty can be promoted to admin" });
    }

    user.isAdmin = true;
    user.role = "admin";
    user.approved = true; // auto approve on promotion
    await user.save();

    res.json({ message: `${user.name} is now an Admin!` });
  } catch (error) {
    res.status(500).json({ message: "Failed to promote user" });
  }
});

// ✅ 4️⃣ Demote an Admin back to Faculty
router.put("/remove-admin/:id", authenticate, verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Prevent removing main admin
    if (user.email === "admin@alumniportal.com") {
      return res.status(403).json({ message: "Cannot remove Main Admin" });
    }

    user.isAdmin = false;
    user.role = "faculty"; // demote to faculty
    await user.save();

    res.json({ message: `${user.name} is no longer an Admin.` });
  } catch (error) {
    res.status(500).json({ message: "Failed to demote user" });
  }
});

// ✅ 5️⃣ Reject/Delete a user (faculty or alumni)
router.delete("/delete-user/:id", authenticate, verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Prevent deleting main admin
    if (user.email === "admin@alumniportal.com") {
      return res.status(403).json({ message: "Cannot delete Main Admin" });
    }

    await user.remove();
    res.json({ message: `${user.name} has been deleted successfully.` });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// ✅ 6️⃣ Leaderboard — view top alumni by points
router.get("/leaderboard", authenticate, verifyAdmin, async (req, res) => {
  try {
    const topUsers = await User.find({ approved: true, role: "alumni" })
      .sort({ "points.total": -1 })
      .limit(50)
      .select("name email role points profilePicture");
    res.json(topUsers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
});

// ✅ 7️⃣ Get all admins + faculty (for Manage Admins tab)
router.get("/admins", authenticate, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ["faculty", "admin"] } }).select(
      "name email role isAdmin"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch admins" });
  }
});

module.exports = router;
