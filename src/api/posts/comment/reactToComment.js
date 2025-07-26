// controllers/postController.js
const reactToComment = async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user._id;

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ msg: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    const alreadyReacted = comment.reactions.includes(userId);
    if (alreadyReacted) {
      comment.reactions.pull(userId); // remove
    } else {
      comment.reactions.push(userId); // add
    }

    await post.save();

    // Emit via socket (frontend will listen)
    req.io?.emit("commentReacted", {
      postId,
      commentId,
      userId,
    });

    res.status(200).json({ success: true, reactions: comment.reactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = reactToComment;
