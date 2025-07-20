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

// ---------------- GET POSTS ----------------
router.get("/", getPosts);

// ---------------- CREATE POST ----------------
router.post("/", auth, createPost);

// ---------------- LIKE POST ----------------
router.patch("/:id/like", auth, likePost);

// ---------------- REACT TO POST ----------------
router.patch("/:id/react", auth, reactToPost);

// ---------------- COMMENT ON POST ----------------
router.post("/:id/comment", auth, commentPost);

// ---------------- REPLY TO COMMENT ----------------
router.post("/:postId/comment/:commentId/reply", auth, replyToComment);

// ---------------- EDIT COMMENT ----------------
router.put("/:postId/comment/:commentId", auth, editComment);

// ---------------- DELETE COMMENT ----------------
router.delete("/:postId/comment/:commentId", auth, deleteComment);

// ---------------- POST DETAIL (Optional - Keep for full modal) ----------------
router.get("/posts/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    if (!post) return res.status(404).json({ message: "Post not found" });

    res.json(post);
  } catch (error) {
    console.error("GET /posts/:id error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- EDIT + DELETE POST (No changes) ----------------
router.patch("/:id", auth, editPost);
router.delete("/:id", auth, deletePost);

module.exports = router;
