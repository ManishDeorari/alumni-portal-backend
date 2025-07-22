const Post = require("../../../../models/Post");

const likePost = async (req, res) => {
  try {
    // ✅ 1. Ensure user is logged in
    if (!req.user || !req.user._id) {
      console.warn("❌ No user found in request");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user._id.toString();
    console.log("👤 Like requested by:", userId);

    // ✅ 2. Fetch the post
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // ✅ 3. Toggle like/unlike
    if (!Array.isArray(post.likes)) post.likes = [];

    const alreadyLiked = post.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();

    const updatedPost = await Post.findById(post._id)
    .populate({ path: "user", select: "fullName profilePic" })
    .populate({ path: "likes", select: "_id fullName profilePic" })
    .populate({ path: "comments.user", select: "fullName profilePic" });

    const plainPost = updatedPost.toObject(); // ✅ ensure populated data is retained

    // OPTIONAL: console.log to verify
    console.log("✅ Emitting postLiked with:", {
      user: plainPost.user,
      likes: plainPost.likes.map(l => l.fullName),
    });

    // Emit the *fully populated plain JS object*
    if (req.io) {
      req.io.emit("postLiked", plainPost);
    }

    // ✅ 6. Return updated post
    res.status(200).json(updatedPost);

    console.log("✅ Like updated:", {
      postId: post._id.toString(),
      likedBy: userId,
      totalLikes: post.likes.length,
    });

  } catch (error) {
    console.error("🔥 Like post error:", error.message);
    res.status(500).json({ message: "Failed to like post", error: error.message });
  }
};

module.exports = likePost;
