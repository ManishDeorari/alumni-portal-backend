const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");

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
} = require("../api/posts/postController");

console.log("Imported functions from postController:", {
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
});


router.get("/", getPosts);
router.post("/", verifyToken, createPost);
router.patch("/:id/like", verifyToken, likePost);
router.patch("/:id/react", verifyToken, reactToPost);
router.post("/:id/comment", verifyToken, commentPost);
router.post("/:postId/comment/:commentId/reply", verifyToken, replyToComment);
router.delete("/:postId/comment/:commentId", verifyToken, deleteComment);
router.patch("/:id", verifyToken, editPost);
router.delete("/:id", verifyToken, deletePost);
router.put("/:postId/comments/:commentId", verifyToken, editComment);

module.exports = router;
