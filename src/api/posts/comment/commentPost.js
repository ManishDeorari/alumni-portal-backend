const Post = require("../../../../models/Post");

const commentPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const { text } = req.body;
    const userId = req.user._id;

    const comment = {
      user: userId,
      text,
      createdAt: new Date(),
    };

    post.comments.push(comment);
    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate("author", "fullName profilePic")
      .populate("comments.user", "fullName profilePic");

    req.io.emit("postUpdated", updatedPost);
    res.status(201).json(updatedPost.comments);
  } catch (error) {
    console.error("Comment error:", error.message);
    res.status(500).json({ message: "Failed to comment" });
  }
};

module.exports = commentPost;
