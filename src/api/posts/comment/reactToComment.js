const Post = require("../../../../models/Post");

const reactToComment = async (req, res) => {
  const { postId, commentId } = req.params;
  const { emoji } = req.body;
  const userId = req.user._id.toString();

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ msg: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    // ✅ Ensure reactions is always a Map
    if (!(comment.reactions instanceof Map)) {
      comment.reactions = new Map(Object.entries(comment.reactions || {}));
    }

    let userAlreadyReacted = false;

    // ✅ Remove user from all previous emojis
    for (const [key, users] of comment.reactions.entries()) {
      const filtered = users.filter((id) => id.toString() !== userId);

      // Detect if undoing
      if (key === emoji && filtered.length !== users.length) {
        userAlreadyReacted = true;
      }

      comment.reactions.set(key, filtered);
    }

    // ✅ Add new reaction if not undoing
    if (!userAlreadyReacted) {
      const current = comment.reactions.get(emoji) || [];
      comment.reactions.set(emoji, [...current, userId]);
    }

    await post.save();

    // Re-fetch updated post with all user details
    const updatedPost = await Post.findById(postId)
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");

    // Send plain object
    const plainPost = updatedPost.toJSON();

    // Emit event
    req.io?.emit("postUpdated", plainPost);

    const updatedComment = plainPost.comments.find(c => c._id === commentId);
    res.status(200).json({ comment: updatedComment });

  } catch (err) {
    console.error("🔥 Comment reaction error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = reactToComment;
