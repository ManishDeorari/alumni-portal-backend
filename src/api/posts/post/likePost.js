const Post = require("../../../../models/Post");

const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const userId = req.user._id;

    const index = post.likes.indexOf(userId);
    if (index > -1) {
      post.likes.splice(index, 1);
    } else {
      post.likes.push(userId);
    }

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate("author", "fullName profilePic")
      .populate("comments.user", "fullName profilePic");

    req.io.emit("postUpdated", updatedPost);
    res.status(200).json(updatedPost);
  } catch (error) {
    console.error("Like post error:", error.message);
    res.status(500).json({ message: "Failed to like post" });
  }
};

module.exports = likePost;
