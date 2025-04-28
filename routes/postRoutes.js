const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ GET all posts
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error("❌ Error fetching posts:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ POST create a post
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    const newPost = new Post({
      user: req.user.id,
      content,
    });
    await newPost.save();
    res.status(201).json(newPost);
  } catch (error) {
    console.error("❌ Error creating post:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
