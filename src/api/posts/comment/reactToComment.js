const Post = require("../../../../models/Post");

const reactToComment = async (req, res) => {
  const { postId, commentId } = req.params;
  const { emoji } = req.body;
  const userId = req.user._id.toString();

  try {
    const post = await Post.findById(postId).populate({
      path: "comments.user",
      select: "name profilePicture"
    });
    if (!post) return res.status(404).json({ msg: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    if (!(comment.reactions instanceof Map)) {
      comment.reactions = new Map(Object.entries(comment.reactions || {}));
    }

    let wasInAnyBucket = false;
    let isSameEmoji = false;
    for (const [key, users] of comment.reactions.entries()) {
      const filtered = users.filter((id) => id.toString() !== userId);
      if (filtered.length !== users.length) {
        wasInAnyBucket = true;
        if (key === emoji) isSameEmoji = true;
      }
      comment.reactions.set(key, filtered);
    }

    if (!isSameEmoji) {
      const current = comment.reactions.get(emoji) || [];
      comment.reactions.set(emoji, [...current, userId]);
    }

    post.markModified("comments");
    await post.save();

    const commentOwnerId = comment.user?._id ? comment.user._id.toString() : comment.user.toString();

    // ✅ Award Points Logic (Initial reaction only)
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

        const Notification = require("../../../../models/Notification");
        const pointsNotification = new Notification({
          sender: user._id,
          receiver: user._id,
          type: "points_earned",
          message: `You earned ${pts} points by Like.`,
        });
        await pointsNotification.save();

        if (req.io) {
          const populatedNote = await Notification.findById(pointsNotification._id).populate("sender", "name profilePicture");
          req.io.to(user._id.toString()).emit("newNotification", populatedNote);
        }
      } catch (awardErr) {
        console.error("❌ Failed to award points for comment reaction:", awardErr.message);
      }
    }

    // Trigger Notification for the comment owner
    if (!isSameEmoji && commentOwnerId !== userId) {
      const Notification = require("../../../../models/Notification");
      const newNotification = new Notification({
        sender: userId,
        receiver: commentOwnerId,
        type: "comment_reaction",
        message: `${req.user.name} reacted ${emoji} to your comment`,
        postId: postId,
        commentId: commentId,
      });
      await newNotification.save();

      if (req.io) {
        const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
        req.io.to(commentOwnerId).emit("newNotification", populatedNotification);
      }
    }

    console.log("🔄 Fetching updated post...");

    // ✅ Fetch fully updated post with comment + reply users
    const updatedPost = await Post.findById(postId)
      .populate("user", "name profilePicture")
      .populate({
        path: "comments",
        populate: [
          { path: "user", select: "name profilePicture" },
          { path: "replies.user", select: "name profilePicture" },
        ],
      });

    const postObj = updatedPost.toObject();

    // ✅ Convert Maps ➜ plain objects for comment + replies
    postObj.comments = postObj.comments.map((c) => {
      if (c.reactions instanceof Map || typeof c.reactions?.get === "function") {
        c.reactions = Object.fromEntries(c.reactions);
      }
      c.replies = c.replies?.map((r) => {
        if (r.reactions instanceof Map || typeof r.reactions?.get === "function") {
          r.reactions = Object.fromEntries(r.reactions);
        }
        return r;
      });
      return c;
    });

    if (postObj.reactions instanceof Map || typeof postObj.reactions?.get === "function") {
      postObj.reactions = Object.fromEntries(postObj.reactions);
    }

    req.io?.emit("postUpdated", postObj);
    req.io?.emit("commentReacted", { postId, commentId, userId, emoji });

    const updatedComment = postObj.comments.find((c) => c._id.toString() === commentId);

    res.status(200).json({ comment: updatedComment });
  } catch (err) {
    console.error("🔥 Comment reaction error:", err.message);
    console.error("Full error:", err);
    console.error("Stack:", err.stack);
    res.status(500).json({ error: err.message });
  }
};

module.exports = reactToComment;
