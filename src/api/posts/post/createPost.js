const Post = require("../../../../models/Post");
const User = require("../../../../models/User");
const PointsSystemConfig = require("../../../../models/PointsSystemConfig");

const createPost = async (req, res) => {
  try {
    const { content, images, video, type } = req.body;
    const userRole = req.user.role;
    const isAdmin = req.user.isAdmin;

    const hasContent = content?.trim()?.length > 0;
    const hasImages = Array.isArray(images) && images.length > 0;
    const hasVideo = video?.url;

    if (!hasContent && !hasImages && !hasVideo) {
      return res.status(400).json({ message: "Post must contain text or media." });
    }

    // Role-based validation for post type
    let finalType = "Regular";
    if (type && type !== "Regular") {
      if (type === "Session" && userRole === "alumni") {
        finalType = "Session";
      } else if (type === "Event" && (userRole === "faculty" || isAdmin)) {
        finalType = "Event";
      } else if (type === "Announcement" && isAdmin) {
        finalType = "Announcement";
      } else {
        return res.status(403).json({ message: `You are not authorized to create a post of type ${type}` });
      }
    }

    const post = new Post({
      user: req.user._id || req.user.id,
      content: hasContent ? content.trim() : "",
      images: hasImages ? images : [],
      video: hasVideo ? video : null,
      type: finalType,
    });

    await post.save();
    const populated = await post.populate("user", "name profilePicture");
    req.io?.emit("postCreated", populated);

    // ✅ Award Points Logic
    if (userRole === "alumni") {
      try {
        const user = await User.findById(req.user._id || req.user.id);
        const config = (await PointsSystemConfig.findOne()) || { postPoints: 10, postLimitCount: 3, postLimitDays: 7 };

        const now = new Date();
        const limitMs = (config.postLimitDays || 7) * 24 * 60 * 60 * 1000;

        // Filter logs to find those within the limit window
        const recentLogs = (user.postPointLogs || []).filter(date => (now - new Date(date)) < limitMs);

        if (recentLogs.length < (config.postLimitCount || 3)) {
          // Award points
          if (!user.points) user.points = { total: 0 };
          user.points.total = (user.points.total || 0) + (config.postPoints || 10);

          // Add to category
          if (user.points.posts === undefined) user.points.posts = 0;
          user.points.posts += (config.postPoints || 10);

          if (user.points.contentContribution === undefined) user.points.contentContribution = 0;
          user.points.contentContribution += (config.postPoints || 10);

          // Update logs
          if (!user.postPointLogs) user.postPointLogs = [];
          user.postPointLogs.push(now);

          await user.save();
          console.log(`✅ Awarded ${config.postPoints} points to user ${user.name} for posting.`);
        } else {
          console.log(`ℹ️ Post limit reached for user ${user.name}, no points awarded.`);
        }
      } catch (awardErr) {
        console.error("❌ Failed to award points:", awardErr.message);
      }
    }

    res.status(201).json({ post: populated });

    console.log("🖼️ Received images:", images);
  } catch (err) {
    console.error("❌ Post creation failed:", err);
    res.status(500).json({ message: "Failed to create post" });
  }
};

module.exports = createPost;
