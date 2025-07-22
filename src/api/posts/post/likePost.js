const Post = require("../../../../models/Post");

const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const userId = req.user._id.toString();

    if (!Array.isArray(post.likes)) {
      post.likes = []; // fallback to empty
    }

    const index = post.likes.findIndex((id) => id.toString() === userId);

    if (index > -1) {
      post.likes.splice(index, 1); // undo like
    } else {
      post.likes.push(userId); // like
    }

    await post.save();

    // Fetch fresh with populated fields safely
    const updatedPost = await Post.findById(post._id)
      .populate({ path: "author", select: "fullName profilePic" })
      .populate({ path: "comments.user", select: "fullName profilePic" })
      .lean();

    if (!updatedPost) {
      return res.status(404).json({ message: "Post not found after update" });
    }

    // Optional: wrap socket in try-catch
    try {
      req.io.emit("postUpdated", updatedPost);
    } catch (socketErr) {
      console.warn("Socket emit failed:", socketErr.message);
    }

    res.status(200).json(updatedPost);
  } catch (error) {
    console.error("Like post error:", error);
    res.status(500).json({ message: "Failed to like post", error: error.message });
  }
};

module.exports = likePost;
