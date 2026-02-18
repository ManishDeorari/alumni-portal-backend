const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Post = require("../models/Post");
const cloudinary = require("../config/cloudinary");
const authenticate = require("../middleware/authMiddleware");

const { sendApprovalEmail, sendRejectionEmail, sendDeletionEmail } = require("../utils/emailService");

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

// ✅ 1.5 Get all users (for User Management tab)
router.get("/all-users", authenticate, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select("-password").sort({ name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch all users" });
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

    // Send email notification (Non-blocking)
    sendApprovalEmail(user).catch(err => console.error("Failed to send approval email:", err.message));

    res.json({ message: `${user.name} has been approved successfully!` });
  } catch (error) {
    console.error("Approval error:", error);
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

    // 🛡 Prevent removing main admin
    if (user.isMainAdmin || user.email === "manishdeorari377@gmail.com") {
      return res.status(403).json({ message: "Cannot demote Main Admin" });
    }

    user.isAdmin = false;
    user.role = "faculty";
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
    if (user.isMainAdmin || user.email === "admin@alumniportal.com" || user.email === "manishdeorari377@gmail.com") {
      return res.status(403).json({ message: "Cannot delete Main Admin" });
    }

    console.log(`🚀 Starting Deep Delete for user: ${user.name} (${user.email})`);

    // 1. Collect Media for Cloudinary Cleanup
    const publicIds = [];

    // Profile & Banner (Extract from URL if string)
    const extractId = (url) => {
      if (!url || !url.includes("res.cloudinary.com")) return null;
      try {
        const parts = url.split("/");
        const lastPart = parts[parts.length - 1];
        const folderPart = url.includes("/posts/") ? "posts/" : ""; // Adjust based on your folder structure if known
        // Simpler: find /upload/ and take everything after (minus version and extension)
        const afterUpload = url.split("/upload/")[1];
        if (!afterUpload) return null;
        const noVersion = afterUpload.replace(/v\d+\//, "");
        return noVersion.substring(0, noVersion.lastIndexOf("."));
      } catch (e) { return null; }
    };

    const profileId = extractId(user.profilePicture);
    if (profileId) publicIds.push({ id: profileId, type: "image" });

    const bannerId = extractId(user.bannerImage);
    if (bannerId) publicIds.push({ id: bannerId, type: "image" });

    // 2. Find all User Posts & collect their media
    const userPosts = await Post.find({ user: user._id });
    userPosts.forEach(post => {
      (post.images || []).forEach(img => {
        if (img.public_id) publicIds.push({ id: img.public_id, type: "image" });
      });
      if (post.video?.public_id) {
        publicIds.push({ id: post.video.public_id, type: "video" });
      }
    });

    // 3. Destroy Media on Cloudinary
    for (const item of publicIds) {
      try {
        await cloudinary.uploader.destroy(item.id, { resource_type: item.type });
        console.log(`🗑 Deleted ${item.type}: ${item.id}`);
      } catch (err) {
        console.error(`❌ Cloudinary cleanup failed for ${item.id}:`, err.message);
      }
    }

    // 4. Delete Posts from DB
    await Post.deleteMany({ user: user._id });
    console.log(`🗑 Deleted ${userPosts.length} posts.`);

    // Send email notification (Existing logic)
    sendDeletionEmail(user).catch(err => console.error("Failed to send deletion email:", err.message));

    // 5. Finally Delete User
    await user.deleteOne();
    res.json({ message: `${user.name} and all their data/media have been deleted successfully.` });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// ✅ 6️⃣ Leaderboard — view top alumni by points
router.get("/leaderboard", authenticate, verifyAdmin, async (req, res) => {
  try {
    const topUsers = await User.find({ approved: true, role: "alumni", "points.total": { $gt: 0 } })
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
    const users = await User.find({
      role: { $in: ["faculty", "admin"] },
      isMainAdmin: { $ne: true }, // ✅ exclude main admin
    }).select("name email role isAdmin");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch admins" });
  }
});

// 🏆 Last Year Leaderboard (Alumni only)
router.get("/leaderboard/last-year", authenticate, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({
      role: "alumni",
      "lastYearPoints.total": { $gt: 0 },
    })
      .sort({ "lastYearPoints.total": -1 })
      .limit(50)
      .select("name email profilePicture lastYearPoints");

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch last year leaderboard" });
  }
});

// ✅ 8️⃣ Export Alumni Data (Advanced Filtering)
router.get("/export-alumni", authenticate, verifyAdmin, async (req, res) => {
  const { query, course, year, industry } = req.query;

  try {
    const filter = { role: "alumni", approved: true };

    if (query) {
      const regex = new RegExp(query, "i");
      filter.$or = [
        { name: regex },
        { email: regex },
        { enrollmentNumber: regex },
        { course: regex }
      ];
    }

    if (course) filter.course = course;
    if (year) filter.year = year;
    if (industry) filter["workProfile.industry"] = { $regex: new RegExp(industry, "i") };

    const users = await User.find(filter)
      .select("name email enrollmentNumber phone whatsapp linkedin address education experience workProfile jobPreferences course year")
      .sort({ name: 1 });

    res.json(users);
  } catch (err) {
    console.error("Export Search Error:", err);
    res.status(500).json({ message: "Search failed", error: err.message });
  }
});

module.exports = router;

