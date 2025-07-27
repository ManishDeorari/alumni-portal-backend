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

    // ✅ Ensure reactions is a Map
    if (!(comment.reactions instanceof Map)) {
      comment.reactions = new Map(Object.entries(comment.reactions || {}));
    }

    let userAlreadyReacted = false;

    console.log("🔄 Before update:", Object.fromEntries(comment.reactions));

    // ✅ Remove user from all existing reactions
    for (const [key, users] of comment.reactions.entries()) {
      const filtered = users.filter((id) => id.toString() !== userId);

      if (key === emoji && filtered.length !== users.length) {
        userAlreadyReacted = true; // user is removing the same emoji (undo)
        console.log(`❌ Undo reaction "${emoji}" by user ${userId}`);
      }

      comment.reactions.set(key, filtered);
    }

    // ✅ Add new reaction if it's not undo
    if (!userAlreadyReacted) {
      const current = comment.reactions.get(emoji) || [];
      comment.reactions.set(emoji, [...current, userId]);
      console.log(`✅ Added reaction "${emoji}" by user ${userId}`);
    }

    console.log("✅ After update:", Object.fromEntries(comment.reactions));

    post.markModified("comments");
    await post.save();

    // ✅ Re-fetch updated post
    const updatedPost = await Post.findById(postId)
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");

    const plainPost = updatedPost.toJSON();

    // ✅ Emit full post update (optional but already present)
    req.io?.emit("postUpdated", plainPost);

    // ✅ Emit specific comment reaction update
    req.io?.emit("commentReacted", {
      postId,
      commentId,
      userId,
      emoji,
    });

    console.log("📤 Emitted: commentReacted", {
      postId,
      commentId,
      userId,
      emoji,
    });

    // ✅ Extract and convert the updated comment reactions
    const updatedComment = plainPost.comments.find((c) => c._id === commentId);

    if (updatedComment?.reactions instanceof Map) {
      updatedComment.reactions = Object.fromEntries(updatedComment.reactions);
    } else if (
      updatedComment?.reactions &&
      typeof updatedComment.reactions.get === "function"
    ) {
      updatedComment.reactions = Object.fromEntries(updatedComment.reactions);
    }

    res.status(200).json({ comment: updatedComment });
  } catch (err) {
    console.error("🔥 Comment reaction error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = reactToComment;
