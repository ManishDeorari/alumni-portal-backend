// backend/src/api/posts/route.js

const express = require("express");
const Post = require("../../../models/Post");
const authMiddleware = require("../../../middleware/authMiddleware");

const router = express.Router();

// Get all posts
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

// Create a new post
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;

    const newPost = new Post({
      content,
      author: userId,
    });

    await newPost.save();
    res.status(201).json(newPost);
  } catch (err) {
    console.error("Create Post Error:", err);
    res.status(500).json({ message: "Post creation failed" });
  }
});

// Like a post
router.patch("/:id/like", authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const userId = req.user.id;
    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: "Failed to like post" });
  }
});

// Comment on a post
router.post("/:id/comment", authMiddleware, async (req, res) => {
  try {
    const { comment } = req.body;
    const userId = req.user.id;

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({ user: userId, text: comment });
    await post.save();

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: "Failed to comment" });
  }
});

module.exports = router;
