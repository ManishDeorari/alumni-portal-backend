const Post = require("../../../../models/Post");

const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type || "Regular";
    const userId = req.query.userId;
    let filter = {};

    if (type === "all") {
      filter = {};
    } else if (type === "Regular") {
      filter = { $or: [{ type: "Regular" }, { type: { $exists: false } }, { type: null }] };
    } else {
      filter = { type };
    }

    if (userId) {
      filter.user = userId;
    }

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const total = await Post.countDocuments(filter);

    res.json({ posts, total });
  } catch (err) {
    console.error("❌ Fetch posts failed:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};

module.exports = getPosts;
