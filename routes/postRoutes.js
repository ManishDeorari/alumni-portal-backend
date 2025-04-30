const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");

// Get all posts with author info
router.get("/", async (req, res) => {
  const posts = await Post.find().populate("author", "name profilePic").sort({ createdAt: -1 });
  res.json(posts);
});

// Create post
router.post("/", authMiddleware, async (req, res) => {
  const post = new Post({ content: req.body.content, author: req.user.id });
  await post.save();
  res.status(201).json(post);
});

// Like/unlike
router.patch("/:id/like", authMiddleware, async (req, res) => {
  const post = await Post.findById(req.params.id);
  const userId = req.user.id;

  if (post.likes.includes(userId)) {
    post.likes.pull(userId);
  } else {
    post.likes.push(userId);
  }

  await post.save();
  res.json({ likes: post.likes.length });
});

// Add comment
router.post("/:id/comment", authMiddleware, async (req, res) => {
  const post = await Post.findById(req.params.id);
  post.comments.push({ user: req.user.id, text: req.body.text });
  await post.save();
  res.json(post.comments);
});

module.exports = router;
