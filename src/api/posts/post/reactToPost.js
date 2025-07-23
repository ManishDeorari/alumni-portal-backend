const Post = require("../../../../models/Post");

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    let reactions = post.reactions || new Map();
    let userAlreadyReacted = false;

    // ✅ Step 1: Remove user from all emojis
    for (const [key, userIds] of reactions.entries()) {
      const filtered = userIds.filter(
        (id) => id.toString() !== userId.toString()
      );
      if (filtered.length !== userIds.length) userAlreadyReacted = key === emoji;
      reactions.set(key, filtered);
    }

    // ✅ Step 2: Add new emoji if not undoing
    if (!userAlreadyReacted) {
      const current = reactions.get(emoji) || [];
      reactions.set(emoji, [...current, userId]);
    }

    post.reactions = reactions;
    await post.save();

    // ✅ Step 3: Re-fetch full post with population
    const updatedPost = await Post.findById(post._id)
      .populate({ path: "user", select: "name profilePicture" })
      .populate({ path: "likes", select: "_id name profilePicture" })
      .populate({ path: "comments.user", select: "name profilePicture" })
      .exec();

    const plainPost = updatedPost.toObject(); // convert to plain JS

    // ✅ Step 4: Broadcast updated post via socket
    if (req.io) {
      req.io.emit("postReacted", plainPost);
      console.log("📡 Emitted postReacted");
    }

    // ✅ Step 5: Respond with full post (for this user too)
    res.status(200).json(plainPost);
  } catch (error) {
    console.error("🔥 Reaction error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};
