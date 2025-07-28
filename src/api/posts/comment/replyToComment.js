const Post = require("../../../../models/Post");

const replyToComment = async (req, res) => {
  try {
    const { text } = req.body;
    const { postId, commentId } = req.params;
    const userId = req.user._id;

    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // 🔒 Optional: Restrict replies only to post owner
    const restrictRepliesToOwner = false;
    if (restrictRepliesToOwner && post.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the post owner can reply to comments." });
    }

    // 💬 Push new reply
    comment.replies.push({
      user: userId,
      text: text.trim(),
      createdAt: new Date(),
    });

    await post.save();

    const updatedPost = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" })
      .lean();

    // 🔁 Emit real-time update
    req.io.emit("postUpdated", updatedPost);

    res.json(updatedPost);
  } catch (err) {
    console.error("❌ Reply failed:", err);
    res.status(500).json({ message: "Reply failed" });
  }
};

module.exports = replyToComment;
