const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const {
  getPosts,
  createPost,
  reactToPost,
  commentPost,
  replyToComment,
  deleteComment,
  editPost,
  deletePost,
  editComment,
  reactToComment,
} = require("../src/api/posts/postController");

const Post = require("../models/Post"); // Required for GET /posts/:id

// ---------------- GET ALL POSTS ----------------
router.get("/", getPosts);

// ---------------- CREATE POST ----------------
router.post("/", auth, createPost);

// ---------------- REACT TO POST ----------------
router.patch("/:id/react", auth, reactToPost);

// ---------------- COMMENT ON POST ----------------
router.post("/:id/comment", auth, commentPost);

// ---------------- REACT TO COMMENT ----------------
router.post("/:postId/comment/:commentId/react", auth, reactToComment);

// ---------------- REPLY TO COMMENT ----------------
router.post("/:postId/comment/:commentId/reply", auth, replyToComment);

// ---------------- EDIT COMMENT ----------------
router.put("/:postId/comment/:commentId", auth, editComment);

// ---------------- DELETE COMMENT ----------------
router.delete("/:postId/comment/:commentId", auth, deleteComment);

// ---------------- GET SINGLE POST (For Modal/View Full Thread) ----------------
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    if (!post) return res.status(404).json({ message: "Post not found" });

    res.json(post);
  } catch (error) {
    console.error("GET /:id error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- EDIT POST ----------------
router.patch("/:id", auth, editPost);

// ---------------- DELETE POST ----------------
router.delete("/:id", auth, deletePost);

module.exports = router;
