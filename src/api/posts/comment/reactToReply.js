const Post = require("../../../../models/Post");

const reactToReply = async (req, res) => {
  const { postId, commentId, replyId } = req.params;
  const { emoji } = req.body;
  const userId = req.user._id.toString();

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ msg: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ msg: "Reply not found" });

    // Ensure reply.reactions is a Map
    if (!(reply.reactions instanceof Map)) {
      reply.reactions = new Map(Object.entries(reply.reactions || {}));
    }

    // Remove existing reaction by user
    let userAlreadyReacted = false;
    for (const [key, users] of reply.reactions.entries()) {
      const filtered = users.filter((id) => id.toString() !== userId);
      if (key === emoji && filtered.length !== users.length) {
        userAlreadyReacted = true;
      }
      reply.reactions.set(key, filtered);
    }

    // Add new reaction if not already reacted
    if (!userAlreadyReacted) {
      const current = reply.reactions.get(emoji) || [];
      reply.reactions.set(emoji, [...current, userId]);
    }

    post.markModified("comments");
    await post.save();

    const updatedPost = await Post.findById(postId)
      .populate("user", "name profilePicture")
      .populate({
        path: "comments",
        populate: [
          { path: "user", select: "name profilePicture" },
          { path: "replies.user", select: "name profilePicture" },
        ],
      });

    // Emit updated post and reply reaction info via socket
    req.io.emit("postUpdated", updatedPost);
    req.io.emit("replyReacted", {
      postId,
      commentId,
      replyId,
      emoji,
      userId,
    });

    res.json(updatedPost);
  } catch (err) {
    console.error("❌ React to reply error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = reactToReply;
