const Post = require("../models/Post");
const User = require("../models/User");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer setup for memory storage (upload buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage });

exports.uploadMiddleware = upload.single("image");

// Create Post with optional image upload
exports.createPost = async (req, res) => {
  try {
    let imageUrl = "";
    let videoUrl = "";

    if (req.file) {
      const fileType = req.file.mimetype;

      const uploadResult = await cloudinary.uploader.upload(
        `data:${fileType};base64,${req.file.buffer.toString("base64")}`,
        {
          folder: "posts",
          resource_type: fileType.startsWith("video") ? "video" : "image",
        }
      );

      if (fileType.startsWith("video")) {
        videoUrl = uploadResult.secure_url;
      } else {
        imageUrl = uploadResult.secure_url;
      }
    }

    const post = new Post({
      user: req.user._id,
      content: req.body.content,
      image: imageUrl,
      video: videoUrl,
      likes: [],
      comments: [],
      reactions: {},
    });

    await post.save();
    const populatedPost = await post.populate("user", "name profilePic");
    res.status(201).json(populatedPost);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create post" });
  }
};

// Get all posts
exports.getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic")
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Failed to get posts" });
  }
};

// Like or unlike post
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const userId = req.user._id.toString();
    if (!post) return res.status(404).json({ message: "Post not found" });

    const liked = post.likes.includes(userId);
    if (liked) {
      post.likes = post.likes.filter((id) => id !== userId);
    } else {
      post.likes.push(userId);
      // Notify post owner (if not self)
      if (post.user.toString() !== userId) {
        const postOwner = await User.findById(post.user);
        postOwner.notifications.push({
          type: "like",
          message: `${req.user.name} liked your post`,
          fromUser: req.user._id,
          createdAt: new Date(),
          read: false,
        });
        await postOwner.save();
      }
    }

    await post.save();
    const updated = await post
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to like post" });
  }
};

// Add comment to post
exports.commentPost = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "")
      return res.status(400).json({ message: "Comment text required" });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = {
      user: req.user._id,
      text,
      createdAt: new Date(),
    };

    post.comments.push(comment);

    // Notify post owner (if not self)
    if (post.user.toString() !== req.user._id.toString()) {
      const postOwner = await User.findById(post.user);
      postOwner.notifications.push({
        type: "comment",
        message: `${req.user.name} commented on your post`,
        fromUser: req.user._id,
        createdAt: new Date(),
        read: false,
      });
      await postOwner.save();
    }

    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to comment on post" });
  }
};

// React with emoji to post
exports.reactToPost = async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: "Emoji required" });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const userId = req.user._id.toString();
    if (!post.reactions) post.reactions = {};

    const currentUsers = post.reactions.get(emoji) || [];
    if (currentUsers.includes(userId)) {
      post.reactions.set(
        emoji,
        currentUsers.filter((id) => id !== userId)
      );
    } else {
      post.reactions.set(emoji, [...currentUsers, userId]);
    }

    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to react to post" });
  }
};

// Delete post
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post)
      return res.status(404).json({ message: "Post not found" });

    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await post.deleteOne();
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete post" });
  }
};

// Edit post
exports.editPost = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim() === "") {
      return res.status(400).json({ message: "Content cannot be empty" });
    }

    const post = await Post.findById(req.params.id);
    if (!post)
      return res.status(404).json({ message: "Post not found" });

    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    post.content = content;
    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update post" });
  }
};
