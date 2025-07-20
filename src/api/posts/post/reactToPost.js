const Post = require("../../../../models/Post");

const Post = require("../../../../models/Post");

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji, action } = req.body;
    const userId = req.user._id;

    if (!emoji) return res.status(400).json({ message: "Emoji is required" });

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!post.reactions) post.reactions = new Map();

    // Convert to Map if needed (in case it's a plain object)
    if (!(post.reactions instanceof Map)) {
      post.reactions = new Map(Object.entries(post.reactions));
    }

    // Remove reaction logic
    if (action === "remove") {
      for (let [key, userList] of post.reactions.entries()) {
        const updated = userList.filter((uid) => uid.toString() !== userId.toString());
        if (updated.length > 0) {
          post.reactions.set(key, updated);
        } else {
          post.reactions.delete(key);
        }
      }

      await post.save();
      return res.json({ message: "Reaction removed", reactions: Object.fromEntries(post.reactions) });
    }

    // Replace previous reaction (if any)
    for (let [key, userList] of post.reactions.entries()) {
      const updated = userList.filter((uid) => uid.toString() !== userId.toString());
      if (updated.length > 0) {
        post.reactions.set(key, updated);
      } else {
        post.reactions.delete(key);
      }
    }

    // Add new emoji reaction
    const users = post.reactions.get(emoji) || [];
    if (!users.includes(userId)) users.push(userId);
    post.reactions.set(emoji, users);

    await post.save();

    res.json({ message: "Reaction added", reactions: Object.fromEntries(post.reactions) });
  } catch (error) {
    console.error("Error in reactToPost:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
