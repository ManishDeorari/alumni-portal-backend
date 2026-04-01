const Post = require("../../../../models/Post");

const replyToComment = async (req, res) => {
  try {
    const { text } = req.body;
    const { postId, commentId } = req.params; // ✅ FIXED

    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.replies.push({
      user: req.user._id,
      text: text.trim(),
      createdAt: new Date(),
      parentId: commentId, // ✅ Required field, now defined
    });

    await post.save();

    const updated = await Post.findById(postId)
      .populate("user", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    req.io.emit("postUpdated", updated);

    // ✅ Award Points Logic
    if (req.user.role === "alumni") {
      try {
        const User = require("../../../../models/User");
        const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
        const user = await User.findById(req.user._id);
        const config = (await PointsSystemConfig.findOne()) || { commentPoints: 3 };

        if (!user.points) user.points = { total: 0 };
        const pts = config.commentPoints || 3;

        user.points.total = (user.points.total || 0) + pts;
        user.points.comments = (user.points.comments || 0) + pts;
        user.points.contentContribution = (user.points.contentContribution || 0) + pts;

        await user.save();

        const Notification = require("../../../../models/Notification");
        const pointsNotification = new Notification({
          sender: user._id,
          receiver: user._id,
          type: "points_earned",
          message: `You earned ${pts} points by Comment.`, // Using 'Comment' for consistency with comment points
        });
        await pointsNotification.save();

        if (req.io) {
          const populatedNote = await Notification.findById(pointsNotification._id).populate("sender", "name profilePicture");
          req.io.to(user._id.toString()).emit("newNotification", populatedNote);
        }
      } catch (awardErr) {
        console.error("❌ Failed to award points for reply:", awardErr.message);
      }
    }

    // Trigger Notification for the comment owner (if the replier is not the comment owner)
    if (req.user._id.toString() !== comment.user.toString()) {
      const Notification = require("../../../../models/Notification");
      const newNotification = new Notification({
        sender: req.user._id,
        receiver: comment.user,
        type: "comment_reply",
        message: `${req.user.name} replied to your comment: "${text.substring(0, 20)}${text.length > 20 ? "..." : ""}"`,
        postId: postId,
        commentId: commentId,
      });
      await newNotification.save();

      if (req.io) {
        const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
        req.io.to(comment.user.toString()).emit("newNotification", populatedNotification);
      }
    }

    res.json(updated);
  } catch (err) {
    console.error("❌ Reply failed:", {
      message: err.message,
      stack: err.stack,
      postId: req.params.postId,
      commentId: req.params.commentId,
      body: req.body,
      user: req.user,
    });
    res.status(500).json({ message: "Reply failed" });
  }
};

module.exports = replyToComment;
