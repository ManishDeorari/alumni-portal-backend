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
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    req.io.emit("postUpdated", updated);
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
