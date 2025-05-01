const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Post = require("../models/Post");
const User = require("../models/User");

// Create post
router.post("/", authMiddleware, async (req, res) => {
  try {
    const newPost = new Post({
      content: req.body.content,
      author: req.user.id,
    });
    await newPost.save();
    res.status(201).json(newPost);
  } catch (err) {
    console.error("❌ Post creation failed:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all posts with author details
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("author", "name email profileImage");
    res.json(posts);
  } catch (err) {
    console.error("❌ Failed to fetch posts:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// Like/unlike post
router.patch("/:id/like", authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const userId = req.user.id;

    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.likes.includes(userId)) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();
    res.json({ likes: post.likes.length });
  } catch (err) {
    console.error("❌ Like error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// Add comment
router.post("/:id/comment", authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = {
      user: req.user.id,
      text: req.body.text,
    };

    post.comments.push(comment);
    await post.save();

    res.status(201).json(comment);
  } catch (err) {
    console.error("❌ Comment error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
