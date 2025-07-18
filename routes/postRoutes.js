// ✅ postRoutes.js (cleaned version)
const express = require("express");
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

const router = express.Router();
const { verifyToken } = require("../middleware/auth");

// ✅ Routes
router.get("/", getPosts);
router.post("/", auth, createPost);
router.patch("/:id/like", auth, likePost);
router.patch("/:id/react", auth, reactToPost);
router.post("/:id/comment", auth, commentPost);
router.post("/:postId/comment/:commentId/reply", auth, replyToComment);
router.delete("/:postId/comment/:commentId", auth, deleteComment);
router.patch("/:id", auth, editPost);
router.delete("/:id", auth, deletePost);
router.put("/:postId/comments/:commentId", verifyToken, editComment);

module.exports = router;
