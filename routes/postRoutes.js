// routes/postRoutes.js
const express = require("express");
const auth = require("../middleware/authMiddleware");
const {
  getPosts,
  createPost,
  likePost,
  reactToPost,
  commentPost,
  editPost,
  deletePost,
  replyToComment,
  deleteComment,
  uploadMiddleware,
} = require("../src/api/posts/postController");

const router = express.Router();

// ✅ Routes
router.get("/", getPosts);
router.post("/", auth, uploadMiddleware, createPost);

router.patch("/:id/like", auth, likePost);
router.patch("/:id/react", auth, reactToPost);
router.post("/:id/comment", auth, commentPost);
router.patch("/:id", auth, editPost);
router.delete("/:id", auth, deletePost);

// ✅ Replies & Deletion of Comments
router.post("/:postId/comment/:commentId/reply", auth, replyToComment);
router.delete("/:postId/comment/:commentId", auth, deleteComment);

module.exports = router;
