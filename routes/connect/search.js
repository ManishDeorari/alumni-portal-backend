// routes/connect/search.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const User = require("../../models/User");

router.get("/", authMiddleware, async (req, res) => {
  const { query, course, year, industry, skills } = req.query;

  try {
    const currentUser = await User.findById(req.user.id);
    const filter = { _id: { $ne: req.user.id } };

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
    if (industry) filter["workProfile.industry"] = industry;
    if (skills) {
      const skillsArray = skills.split(",").map(s => s.trim());
      filter.skills = { $in: skillsArray.map(s => new RegExp(s, "i")) };
    }

    const users = await User.find(filter)
      .select("name email enrollmentNumber course year profilePicture connections pendingRequests sentRequests workProfile skills")
      .limit(50);

    // mark relationship status
    const result = users.map((u) => {
      let status = "none";
      if (currentUser.connections.includes(u._id)) status = "connected";
      else if (currentUser.sentRequests.includes(u._id)) status = "sent";
      else if (currentUser.pendingRequests.includes(u._id)) status = "pending";

      return {
        ...u._doc,
        connectionStatus: status,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
