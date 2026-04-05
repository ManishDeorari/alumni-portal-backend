const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Post = require("../models/Post");
const Group = require("../models/Group");
const Event = require("../models/Event");
const Connect = require("../models/Connect");
const Notification = require("../models/Notification");
const Registration = require("../models/Registration");
const GroupMessage = require("../models/GroupMessage");
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

    // 🌟 Auto-add new admin to all groups
    await Group.updateMany(
      { members: { $ne: user._id } },
      { $push: { members: user._id } }
    );

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

// 🛡️ Helper: Perform Deep Deletion (Zero Residual Upgrade)
const performDeepDelete = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return { success: false, id: userId, message: "User not found" };

  // Prevent deleting main admin
  if (user.isMainAdmin || user.email === "admin@alumniportal.com" || user.email === "manishdeorari377@gmail.com") {
    return { success: false, id: userId, message: "Cannot delete Main Admin" };
  }

  console.log(`🚀 [DeepDelete] Initiating full system scrub for: ${user.name} (${user.email} | ${user.role})`);

  try {
    // === 1. COLLECT MEDIA FOR CLOUDINARY CLEANUP ===
    const mediaToDestroy = [];

    const extractId = (url) => {
      if (!url || !url.includes("res.cloudinary.com")) return null;
      try {
        const afterUpload = url.split("/upload/")[1];
        if (!afterUpload) return null;
        const noVersion = afterUpload.replace(/v\d+\//, "");
        return noVersion.substring(0, noVersion.lastIndexOf("."));
      } catch (e) { return null; }
    };

    // User Media
    const profileId = extractId(user.profilePicture);
    if (profileId) mediaToDestroy.push({ id: profileId, type: "image" });
    const bannerId = extractId(user.bannerImage);
    if (bannerId) mediaToDestroy.push({ id: bannerId, type: "image" });

    // Post Media (Both Images & Videos)
    const userPosts = await Post.find({ user: user._id });
    userPosts.forEach(post => {
      (post.images || []).forEach(img => {
        if (img.public_id) mediaToDestroy.push({ id: img.public_id, type: "image" });
      });
      if (post.video?.public_id) {
        mediaToDestroy.push({ id: post.video.public_id, type: "video" });
      }
    });

    // Event Media (Both Images & Videos)
    const userEvents = await Event.find({ createdBy: user._id });
    userEvents.forEach(evt => {
      (evt.images || []).forEach(img => {
        if (img.public_id) mediaToDestroy.push({ id: img.public_id, type: "image" });
      });
      if (evt.video?.public_id) {
        mediaToDestroy.push({ id: evt.video.public_id, type: "video" });
      }
    });

    // Faculty-Specific: Group Message Media
    if (user.role === "faculty") {
      const facultyMessages = await GroupMessage.find({ sender: user._id, type: "image" });
      facultyMessages.forEach(msg => {
        if (msg.mediaPublicId) mediaToDestroy.push({ id: msg.mediaPublicId, type: "image" });
      });
    }

    // === 2. EXECUTE CLOUDINARY CLEANUP ===
    for (const item of mediaToDestroy) {
      try {
        await cloudinary.uploader.destroy(item.id, { resource_type: item.type });
        console.log(`🗑  [Cloudinary] Deleted ${item.type}: ${item.id}`);
      } catch (err) {
        console.error(`❌ [Cloudinary] Cleanup failed for ${item.id}:`, err.message);
      }
    }

    // === 3. NETWORK & CONNECTION CLEANUP ===
    // Remove references from other users' connection lists
    await User.updateMany(
      { $or: [ { connections: user._id }, { pendingRequests: user._id }, { sentRequests: user._id } ] },
      { $pull: { connections: user._id, pendingRequests: user._id, sentRequests: user._id } }
    );
    // Delete connection documents
    await Connect.deleteMany({ $or: [{ from: user._id }, { to: user._id }] });

    // === 4. GROUP & EVENT SYSTEM SCRUBBING ===
    // Remove from group member lists
    await Group.updateMany({ members: user._id }, { $pull: { members: user._id } });
    
    // Purge event registrations
    await Registration.deleteMany({ userId: user._id });

    // Faculty-Specific: Purge message history
    if (user.role === "faculty") {
      await GroupMessage.deleteMany({ sender: user._id });
      console.log(`💬 [Messages] Purged all messages from Faculty: ${user.name}`);
    }

    // Pull reactions from all other group messages
    await GroupMessage.updateMany(
      { "reactions.users": user._id },
      { $pull: { "reactions.users": user._id } }
    );

    // === 5. NESTED CONTENT SCRUBBING (INSIDE-OUT) ===
    console.log(`🧹 [DeepScrub] Flushing nested content (Replies -> Comments -> Winners)...`);
    
    // A. POSTS: Flush Replies (Deepest level)
    await Post.updateMany(
      { "comments.replies.user": user._id },
      { $pull: { "comments.$[].replies": { user: user._id } } }
    );

    // B. POSTS: Flush Comments (Intermediate level)
    await Post.updateMany(
      { "comments.user": user._id },
      { $pull: { comments: { user: user._id } } }
    );

    // C. POSTS: Flush Winner Group Members (Nested)
    await Post.updateMany(
       { "announcementDetails.winners.groupMembers": user._id },
       { $pull: { "announcementDetails.winners.$[].groupMembers": user._id } }
    );

    // D. POSTS: Flush Primary Winners (Parent)
    await Post.updateMany(
      { "announcementDetails.winners.userId": user._id },
      { $pull: { "announcementDetails.winners": { userId: user._id } } }
    );

    // E. EVENTS: Flush Replies (Deepest level)
    await Event.updateMany(
      { "comments.replies.user": user._id },
      { $pull: { "comments.$[].replies": { user: user._id } } }
    );

    // F. EVENTS: Flush Comments (Parent level)
    await Event.updateMany(
      { "comments.user": user._id },
      { $pull: { comments: { user: user._id } } }
    );

    // === 6. BULK RECORD REMOVAL ===
    await Post.deleteMany({ user: user._id });
    await Event.deleteMany({ createdBy: user._id });
    await Notification.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] });

    // Send deletion email confirming scrubbing completion
    sendDeletionEmail(user).catch(err => console.error("Failed to send deletion email:", err.message));

    // === 7. FINAL USER DOCUMENT DELETION ===
    await user.deleteOne();
    console.log(`✅ [DeepDelete] Scrubbed: ${user.name} | Residual Data: ZERO`);
    return { success: true, id: userId, name: user.name };

  } catch (error) {
    console.error(`❌ [DeepDelete] CRITICAL ERROR for ${userId}:`, error);
    return { success: false, id: userId, message: error.message };
  }
};

// ✅ 5️⃣ Reject/Delete a user (Single)
router.delete("/delete-user/:id", authenticate, verifyAdmin, async (req, res) => {
  const result = await performDeepDelete(req.params.id);
  if (!result.success) {
    return res.status(result.message.includes("Admin") ? 403 : 404).json({ message: result.message });
  }

  // 🔔 REAL-TIME LOGOUT: Notify user to disconnect immediately
  if (req.io) {
    req.io.to(req.params.id).emit("forceLogout");
    console.log(`📡 [Socket] Emitted forceLogout to user: ${req.params.id}`);
  }

  res.json({ message: `${result.name} and all their data/media have been deleted.` });
});

// ✅ 5.5 Bulk Delete Users
router.post("/delete-users-bulk", authenticate, verifyAdmin, async (req, res) => {
  const { userIds } = req.body;
  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ message: "Invalid user IDs" });
  }

  console.log(`🧹 Bulk deleting ${userIds.length} users...`);

  const results = [];
  // Process in batches of 5 to prevent overwhelming services
  const batchSize = 5;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(async id => {
      const res = await performDeepDelete(id);
      
      // 🔔 REAL-TIME LOGOUT: Notify user to disconnect immediately if deletion is successful
      if (res.success && req.io) {
        req.io.to(id).emit("forceLogout");
        console.log(`📡 [Socket] Emitted forceLogout (bulk) to user: ${id}`);
      }
      return res;
    }));
    results.push(...batchResults);
  }

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  res.json({
    message: `Processed ${userIds.length} deletions.`,
    summary: {
      total: userIds.length,
      successful: successful.length,
      failed: failed.length,
    },
    failedIds: failed.map(f => f.id)
  });
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

    const conditions = [];

    if (query) {
      const regex = new RegExp(query, "i");
      conditions.push({
        $or: [
          { name: regex },
          { email: regex },
          { enrollmentNumber: regex },
          { course: regex }
        ]
      });
    }

    if (course && year) {
      conditions.push({
        $or: [
          { "education.courseYearKey": `${String(course).toUpperCase()}_${year}` },
          { course: new RegExp(`^${course}$`, "i"), year: String(year) }
        ]
      });
    } else if (course) {
      conditions.push({
        $or: [
          { "education.course": String(course).toUpperCase() },
          { course: new RegExp(`^${course}$`, "i") }
        ]
      });
    } else if (year) {
      conditions.push({
        $or: [
          { "education.endYear": Number(year) },
          { year: String(year) }
        ]
      });
    }

    if (conditions.length > 0) {
      filter.$and = conditions;
    }
    
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

