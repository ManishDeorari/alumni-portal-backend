const Post = require("../../../../models/Post");

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (!(post.reactions instanceof Map)) {
      post.reactions = new Map(Object.entries(post.reactions || {}));
    }

    let wasInAnyBucket = false;
    let isSameEmoji = false;
    for (const [key, users] of post.reactions.entries()) {
      const filtered = users.filter(id => id.toString() !== userId);
      if (filtered.length !== users.length) {
        wasInAnyBucket = true;
        if (key === emoji) isSameEmoji = true;
      }
      post.reactions.set(key, filtered);
    }

    if (!isSameEmoji) {
      const current = post.reactions.get(emoji) || [];
      post.reactions.set(emoji, [...current, userId]);
    }

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate({ path: "user", select: "name profilePicture" })
      .populate({
        path: "comments",
        populate: [
          { path: "user", select: "name profilePicture" },
          { path: "replies.user", select: "name profilePicture" },
        ],
      });

    const plainPost = updatedPost.toJSON();

    if (req.io) {
      req.io.emit("postReacted", plainPost);
    }

    // ✅ Award Points Logic (Initial reaction only, to avoid farming on switches)
    if (!wasInAnyBucket && !isSameEmoji && req.user.role === "alumni") {
      try {
        const User = require("../../../../models/User");
        const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
        const user = await User.findById(userId);
        const config = (await PointsSystemConfig.findOne()) || { likePoints: 2 };

        if (!user.points) user.points = { total: 0 };
        const pts = config.likePoints || 2;

        user.points.total = (user.points.total || 0) + pts;
        user.points.likes = (user.points.likes || 0) + pts;
        user.points.studentEngagement = (user.points.studentEngagement || 0) + pts;

        await user.save();

        // ✅ Notification for points
        try {
          const Notification = require("../../../../models/Notification");
          const newNotification = new Notification({
            sender: user._id,
            receiver: user._id,
            type: "points_earned",
            message: `You earned ${pts} points by Like.`,
          });
          await newNotification.save();

          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
            req.io.to(user._id.toString()).emit("newNotification", populatedNotification);
          }
        } catch (noteErr) {
          console.error("❌ Failed to send reaction award notice:", noteErr.message);
        }

        console.log(`✅ Awarded ${pts} points to user ${user.name} for reacting.`);
      } catch (awardErr) {
        console.error("❌ Failed to award points for reaction:", awardErr.message);
      }
    }

    // Trigger Notification for the post owner (Only if it's NOT a toggle off AND not the owner)
    if (!isSameEmoji && userId !== updatedPost.user._id.toString()) {
      const Notification = require("../../../../models/Notification");
      const newNotification = new Notification({
        sender: userId,
        receiver: updatedPost.user._id,
        type: "post_like",
        message: `${req.user.name} reacted with ${emoji} to your post`,
        postId: id,
      });
      await newNotification.save();

      if (req.io) {
        const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
        req.io.to(updatedPost.user._id.toString()).emit("newNotification", populatedNotification);
      }
    }

    res.status(200).json(plainPost);
  } catch (error) {
    console.error("🔥 Reaction error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};
