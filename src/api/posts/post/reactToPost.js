const Post = require("../../../../models/Post");

const reactToPost = async (req, res) => {
  try {
    const { emoji, action } = req.body;
    const post = await Post.findById(req.params.id);
    const userId = req.user._id.toString();

    if (!post) return res.status(404).json({ message: "Post not found" });

    if (typeof post.reactions !== "object" || post.reactions === null) {
      post.reactions = {};
    }

    if (action === "remove") {
      if (!Array.isArray(post.reactions[emoji])) {
        post.reactions[emoji] = [];
      }
      post.reactions[emoji] = post.reactions[emoji].filter((id) => id !== userId);
      if (post.reactions[emoji].length === 0) delete post.reactions[emoji];
    } else {
      Object.keys(post.reactions).forEach((key) => {
        if (!Array.isArray(post.reactions[key])) {
          post.reactions[key] = [];
        }
        post.reactions[key] = post.reactions[key].filter((id) => id !== userId);
        if (post.reactions[key].length === 0) delete post.reactions[key];
      });

      if (!Array.isArray(post.reactions[emoji])) {
        post.reactions[emoji] = [];
      }

      post.reactions[emoji].push(userId);
    }

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate("author", "fullName profilePic")
      .populate("comments.user", "fullName profilePic");

    req.io.emit("postUpdated", updatedPost);
    res.status(200).json(updatedPost);
  } catch (error) {
    console.error("React error:", error);
    res.status(500).json({ message: "Failed to react" });
  }
};

module.exports = reactToPost;
