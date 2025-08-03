const Post = require("../../../../models/Post");

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (!(post.reactions instanceof Map)) {
      post.reactions = new Map(Object.entries(post.reactions || {}));
    }

    let userAlreadyReacted = false;

    for (const [key, users] of post.reactions.entries()) {
      const filtered = users.filter(id => id.toString() !== userId);
      if (key === emoji && filtered.length !== users.length) {
        userAlreadyReacted = true;
      }
      post.reactions.set(key, filtered);
    }

    if (!userAlreadyReacted) {
      const current = post.reactions.get(emoji) || [];
      if (!current.includes(userId)) {
        post.reactions.set(emoji, [...current, userId]);
      }
    }

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate({ path: "user", select: "name profilePicture" })
      .populate({
        path: "comments",
        populate: [
          { path: "user", select: "name profilePicture" },
          { path: "replies.user", select: "name profilePicture" },
        ],
      });

    const plainPost = updatedPost.toJSON();

    if (req.io) {
      req.io.emit("postReacted", plainPost);
    }

    res.status(200).json(plainPost);
  } catch (error) {
    console.error("🔥 Reaction error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};
