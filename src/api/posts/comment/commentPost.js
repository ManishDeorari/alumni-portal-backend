const Post = require("../../../../models/Post");

const commentPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const { text } = req.body;
    const userId = req.user._id;

    const comment = {
      user: userId,
      text,
      createdAt: new Date(),
    };

    // Add comment to post
    const post = await Post.findById(postId);
    post.comments.push(comment);
    await post.save();

    // Repopulate with full user details
    const updatedPost = await Post.findById(postId)
      .populate("user", "name profilePicture")
      .populate("comments.user", "name profilePicture")
      .populate("comments.replies.user", "name profilePicture");

    // Emit socket update
    req.io.emit("postUpdated", updatedPost);

    // Return full updated post (✅ Only one response!)
    res.status(201).json(updatedPost);
  } catch (error) {
    console.error("Comment error:", error.message);
    res.status(500).json({ message: "Failed to comment" });
  }
};

module.exports = commentPost;
