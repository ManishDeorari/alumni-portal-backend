const Post = require("../../../../models/Post");

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    // ✅ Ensure reactions is always a Map
    if (!(post.reactions instanceof Map)) {
      post.reactions = new Map();
    }

    let userAlreadyReacted = false;

    // ✅ Remove user from all emojis
    for (const [key, users] of post.reactions.entries()) {
      const filtered = users.filter(
        (id) => id.toString() !== userId
      );

      if (filtered.length !== users.length && key === emoji) {
        userAlreadyReacted = true;
      }

      post.reactions.set(key, filtered);
    }

    // ✅ If not undoing, add user to emoji array
    if (!userAlreadyReacted) {
      const current = post.reactions.get(emoji) || [];
      if (!current.includes(userId)) {
        post.reactions.set(emoji, [...current, userId]);
      }
    }

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate({ path: "user", select: "name profilePicture" })
      .populate({ path: "likes", select: "_id name profilePicture" })
      .populate({ path: "comments.user", select: "name profilePicture" })
      .exec();

    const plainPost = updatedPost.toJSON(); // uses your toJSON conversion

    // ✅ Emit real-time update
    if (req.io) {
      req.io.emit("postReacted", plainPost);
    }

    res.status(200).json(plainPost);
  } catch (error) {
    console.error("🔥 Reaction error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};
