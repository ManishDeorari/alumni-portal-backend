const Post = require("../../../../models/Post");

const deleteReply = async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    if (reply.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    comment.replies = comment.replies.filter(
      (r) => r._id.toString() !== replyId
    );

    await post.save();

    const updated = await Post.findById(post._id)
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" })
      .lean();

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("❌ Delete reply error:", err);
    res.status(500).json({ message: "Failed to delete reply" });
  }
};

module.exports = deleteReply;
