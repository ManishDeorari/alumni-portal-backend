const Post = require("../../../../models/Post");

const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    const total = await Post.countDocuments();

    res.json({ posts, total });
  } catch (err) {
    console.error("❌ Fetch posts failed:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};

module.exports = getPosts;
