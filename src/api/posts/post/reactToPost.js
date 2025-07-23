const Post = require("../../../../models/Post");

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    // ✅ Convert reactions to plain object if needed
    let reactions = post.reactions || {};
    let userAlreadyReacted = false;

    // ✅ Remove user from all emoji entries
    for (const key in reactions) {
      const users = reactions[key].map((id) => id.toString());
      const filtered = users.filter((id) => id !== userId);
      if (filtered.length !== users.length && key === emoji) {
        userAlreadyReacted = true;
      }
      reactions[key] = filtered;
    }

    // ✅ If not undoing, add user to new emoji
    if (!userAlreadyReacted) {
      if (!reactions[emoji]) reactions[emoji] = [];
      if (!reactions[emoji].includes(userId)) {
        reactions[emoji].push(userId);
      }
    }

    // ✅ Save as plain object
    post.reactions = reactions;
    await post.save();

    // ✅ Re-fetch with populate
    const updatedPost = await Post.findById(post._id)
      .populate({ path: "user", select: "name profilePicture" })
      .populate({ path: "likes", select: "_id name profilePicture" })
      .populate({ path: "comments.user", select: "name profilePicture" })
      .exec();

    const plainPost = updatedPost.toObject();

    // ✅ Emit via socket
    if (req.io) {
      req.io.emit("postReacted", plainPost);
      console.log("📡 Emitted postReacted:", {
        postId: post._id.toString(),
        reactions: plainPost.reactions,
      });
    }

    res.status(200).json(plainPost);
  } catch (error) {
    console.error("🔥 Reaction error:", error);
    res.status(500).json({ error: "Server error" });
  }
};
