const Post = require("../../../../models/Post");

const likePost = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.warn("❌ No user found in request");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user._id.toString();
    console.log("👤 Like requested by:", userId);

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!Array.isArray(post.likes)) post.likes = [];

    const index = post.likes.findIndex((id) => id.toString() === userId);

    if (index > -1) {
      post.likes.splice(index, 1); // Unlike
    } else {
      post.likes.push(userId); // Like
    }

    await post.save();

    const updatedPost = await Post.findById(post._id)
    .populate({ path: "user", select: "fullName profilePic" }) // ✅ FIXED
    .populate({ path: "comments.user", select: "fullName profilePic" })
    .populate({ path: "likes", select: "_id fullName profilePic" }) // ✅ Here
    .lean();

    try {
      if (req.io) {
        req.io.emit("postLiked", updatedPost); // emit the full updated post
      }
    } catch (e) {
      console.warn("Socket emit failed:", e.message);
    }

    res.status(200).json(updatedPost);

    console.log("✅ Like updated:", {
      likes: post.likes.map((id) => id.toString()),
      currentUser: userId,
    });

  } catch (error) {
    console.error("Like post error:", error.message);
    res.status(500).json({ message: "Failed to like post", error: error.message });
  }
};

module.exports = likePost;
