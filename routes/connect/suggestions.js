// routes/connect/suggestions.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const User = require("../../models/User");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) return res.status(404).json({ message: "User not found" });

    // Exclude self, already connected, and already requested
    const excludeIds = [
      req.user._id.toString(),
      ...(currentUser.connections || []).map(id => id.toString()),
      ...(currentUser.sentRequests || []).map(id => id.toString()),
      ...(currentUser.pendingRequests || []).map(id => id.toString())
    ];

    // Basic suggestion logic: find users with same course, industry, or skills
    const suggestions = await User.find({
      _id: { $nin: excludeIds },
      $or: [
        { course: currentUser.course },
        { "workProfile.industry": currentUser.workProfile?.industry },
        { skills: { $in: currentUser.skills || [] } }
      ]
    })
      .select("name course profilePicture enrollmentNumber workProfile skills")
      .limit(10);

    // If not enough suggestions, add some random new alumni
    if (suggestions.length < 5) {
      const moreSuggestions = await User.find({
        _id: { $nin: [...excludeIds, ...suggestions.map(s => s._id)] }
      })
        .select("name course profilePicture enrollmentNumber workProfile skills")
        .sort({ createdAt: -1 })
        .limit(10 - suggestions.length);

      suggestions.push(...moreSuggestions);
    }

    res.json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
