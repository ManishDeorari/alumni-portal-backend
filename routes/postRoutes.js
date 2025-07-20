const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const {
  getPosts,
  createPost,
  likePost,
  reactToPost,
  commentPost,
  replyToComment,
  deleteComment,
  editPost,
  deletePost,
  editComment,
} = require("../src/api/posts/postController");

// Assuming Express
router.get("/posts/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("author", "fullName profilePic") // Optional
      .populate("comments.user", "fullName profilePic"); // Optional

    if (!post) return res.status(404).json({ message: "Post not found" });

    res.json(post);
  } catch (error) {
    console.error("GET /posts/:id error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", getPosts);
router.post("/", auth, createPost);
router.patch("/:id/like", auth, likePost);
router.patch("/:id/react", auth, reactToPost);
router.post("/:id/comment", auth, commentPost);
router.post("/:postId/comment/:commentId/reply", auth, replyToComment);
router.delete("/:postId/comment/:commentId", auth, deleteComment);
router.patch("/:id", auth, editPost);
router.delete("/:id", auth, deletePost);
router.put("/:postId/comments/:commentId", auth, editComment);

module.exports = router;
