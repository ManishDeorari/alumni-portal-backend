const Post = require("../../../../models/Post");

module.exports = async (req, res) => {
  try {
    const { id } = req.params;  // ✅ fix param name
    const { emoji } = req.body;
    const userId = req.user._id;

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    let reactions = post.reactions || new Map();

    let userAlreadyReacted = false;

    // Step 1: Remove user from all emoji arrays
    for (const [key, userIds] of reactions.entries()) {
      const filtered = userIds.filter(id => id.toString() !== userId.toString());
      if (filtered.length !== userIds.length) userAlreadyReacted = key === emoji;
      reactions.set(key, filtered);
    }

    // Step 2: If not undoing, re-add user to new emoji
    if (!userAlreadyReacted) {
      const current = reactions.get(emoji) || [];
      reactions.set(emoji, [...current, userId]);
    }

    post.reactions = reactions;
    await post.save();

    return res.status(200).json({
      message: "Reaction updated",
      reactions: Object.fromEntries(post.reactions),
    });
  } catch (error) {
    console.error("Reaction error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};
