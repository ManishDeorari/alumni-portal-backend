const Post = require("../../../../models/Post");

const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const userId = req.user._id.toString();

    if (!Array.isArray(post.likes)) {
      post.likes = []; // safety fallback
    }

    const index = post.likes.findIndex(id => id.toString() === userId);

    if (index > -1) {
      post.likes.splice(index, 1); // Remove like
    } else {
      post.likes.push(userId); // Add like
    }

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate("author", "fullName profilePic")
      .populate("comments.user", "fullName profilePic");

    req.io.emit("postUpdated", updatedPost);
    res.status(200).json(updatedPost); // ✅ includes updated likes array
  } catch (error) {
    console.error("Like post error:", error.message);
    res.status(500).json({ message: "Failed to like post" });
  }
};

module.exports = likePost;
