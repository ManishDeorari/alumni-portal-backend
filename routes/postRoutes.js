const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");

// Create post
router.post("/", auth, async (req, res) => {
  const post = new Post({
    user: req.user.id,
    content: req.body.content,
  });
  const saved = await post.save();
  const populated = await saved.populate("user", "name profilePic");
  res.json(populated);
});

// Get posts
router.get("/", async (req, res) => {
  const posts = await Post.find()
    .sort({ createdAt: -1 })
    .populate("user", "name profilePic")
    .populate("comments.user", "name profilePic");
  res.json(posts);
});

// Like toggle
router.patch("/:id/like", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  const userId = req.user.id;
  const hasLiked = post.likes.includes(userId);

  if (hasLiked) {
    post.likes.pull(userId);
  } else {
    post.likes.push(userId);
  }

  await post.save();
  const updated = await post.populate("user", "name profilePic").populate("comments.user", "name profilePic");
  res.json(updated);
});

// Comment
router.post("/:id/comment", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  post.comments.push({ user: req.user.id, text: req.body.text });
  await post.save();
  const updated = await post.populate("user", "name profilePic").populate("comments.user", "name profilePic");
  res.json(updated);
});

module.exports = router;
