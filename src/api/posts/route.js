const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const Post = require("../../../models/Post");
const authMiddleware = require("../../../middleware/authMiddleware");

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer + Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "posts",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({ storage });

// GET all posts
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("author", "fullName profilePic")
      .populate("comments.user", "fullName profilePic")
      .populate("likes", "fullName profilePic");

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

// POST a new post (with optional image)
router.post("/", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;
    const imageUrl = req.file?.path || "";

    const newPost = new Post({
      content,
      author: userId,
      image: imageUrl,
    });

    await newPost.save();
    const populated = await Post.findById(newPost._id)
      .populate("author", "fullName profilePic");

    res.status(201).json(populated);
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
    const populated = await Post.findById(post._id)
      .populate("likes", "fullName profilePic");

    res.json(populated);
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

    const populated = await Post.findById(post._id)
      .populate("comments.user", "fullName profilePic");

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Failed to comment" });
  }
});

module.exports = router;
