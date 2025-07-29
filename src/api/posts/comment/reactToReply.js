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

    // Remove any existing reaction by the user
    let userAlreadyReacted = false;
    for (const [key, users] of reply.reactions.entries()) {
      const filtered = users.filter((id) => id.toString() !== userId);
      if (key === emoji && filtered.length !== users.length) {
        userAlreadyReacted = true;
      }
      reply.reactions.set(key, filtered);
    }

    // If not already reacted, add the new reaction
    if (!userAlreadyReacted) {
      const current = reply.reactions.get(emoji) || [];
      reply.reactions.set(emoji, [...current, userId]);
    }

    post.markModified("comments"); // since we edited a nested field
    await post.save();

    // Fetch updated post and populate
    const updatedPost = await Post.findById(postId)
      .populate("user", "name profilePic")
      .populate({
        path: "comments",
        populate: [
          { path: "user", select: "name profilePic" },
          { path: "replies.user", select: "name profilePic" },
        ],
      })
      .lean(); // important for modifying structure below

    // 🔁 Normalize all .reactions from Map to Object: post, comment, reply
    if (updatedPost.reactions instanceof Map || typeof updatedPost.reactions?.get === "function") {
      updatedPost.reactions = Object.fromEntries(updatedPost.reactions);
    }

    updatedPost.comments = updatedPost.comments.map((c) => {
      // Fix comment-level reactions
      if (c.reactions instanceof Map || typeof c.reactions?.get === "function") {
        c.reactions = Object.fromEntries(c.reactions);
      }

      // Fix each reply's reactions
      if (Array.isArray(c.replies)) {
        c.replies = c.replies.map((r) => {
          if (r.reactions instanceof Map || typeof r.reactions?.get === "function") {
            r.reactions = Object.fromEntries(r.reactions);
          }
          return r;
        });
      }

      return c;
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

    // Send the final result
    res.json(updatedPost);
  } catch (err) {
    console.error("❌ React to reply error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = reactToReply;
