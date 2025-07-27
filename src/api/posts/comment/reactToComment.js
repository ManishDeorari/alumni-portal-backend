const reactToComment = async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user._id;

  try {
    const post = await Post.findById(postId).populate("comments.user"); // include full data
    if (!post) return res.status(404).json({ msg: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    const alreadyReacted = comment.reactions.includes(userId);
    if (alreadyReacted) {
      comment.reactions.pull(userId);
    } else {
      comment.reactions.push(userId);
    }

    await post.save();

    // Fetch the updated post again with populated comments
    const updatedPost = await Post.findById(postId)
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");

    // Emit full post
    req.io?.emit("postUpdated", updatedPost);

    return res.status(200).json(updatedPost); // send full updated post
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
module.exports = reactToComment;
