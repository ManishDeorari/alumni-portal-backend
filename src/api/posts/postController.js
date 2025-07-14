const Post = require("../models/Post");
const User = require("../models/User");
const cloudinary = require("../../../config/cloudinary");
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage });
exports.uploadMiddleware = upload.single("media");

// Utility to notify post owner
const notify = async (targetUserId, fromUserId, type, message) => {
  if (targetUserId.toString() === fromUserId.toString()) return;
  const user = await User.findById(targetUserId);
  user.notifications.push({ type, message, fromUser: fromUserId, createdAt: new Date(), read: false });
  await user.save();
};

// 🔥 Create a new post
exports.createPost = async (req, res) => {
  try {
    let imageUrl = "", videoUrl = "";

    if (req.file) {
      const isVideo = req.file.mimetype.startsWith("video/");
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "posts",
        resource_type: isVideo ? "video" : "image",
      });
      if (isVideo) videoUrl = uploadResult.secure_url;
      else imageUrl = uploadResult.secure_url;
    }

    const post = new Post({
      user: req.user._id,
      content: req.body.content,
      image: imageUrl,
      video: videoUrl,
    });

    await post.save();
    const populated = await post.populate("user", "name profilePic");
    res.status(201).json(populated);
  } catch (err) {
    console.error("Post creation failed:", err);
    res.status(500).json({ message: "Failed to create post" });
  }
};

// 📥 Get all posts
exports.getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};

// 👍 Like or unlike
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
      await notify(post.user, userId, "like", `${req.user.name} liked your post`);
    }

    await post.save();
    const updated = await post.populate("user", "name profilePic").populate("comments.user", "name profilePic");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Like action failed" });
  }
};

// 💬 Comment on post
exports.commentPost = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "")
      return res.status(400).json({ message: "Comment text is required" });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({ user: req.user._id, text, createdAt: new Date() });

    await notify(post.user, req.user._id, "comment", `${req.user.name} commented on your post`);
    await post.save();

    const updated = await post.populate("user", "name profilePic").populate("comments.user", "name profilePic");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Comment failed" });
  }
};

// 😄 Emoji reaction with add/remove logic
exports.reactToPost = async (req, res) => {
  try {
    const { emoji, action } = req.body;
    const userId = req.user._id.toString();

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const currentUsers = post.reactions.get(emoji) || [];

    if (action === "remove") {
      post.reactions.set(emoji, currentUsers.filter((id) => id !== userId));
      if (post.reactions.get(emoji).length === 0) post.reactions.delete(emoji);
    } else if (action === "add") {
      if (!currentUsers.includes(userId)) {
        post.reactions.set(emoji, [...currentUsers, userId]);
        await notify(post.user, userId, "reaction", `reacted ${emoji} to your post`);
      }
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await post.save();
    const updated = await post.populate("user", "name profilePic").populate("comments.user", "name profilePic");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Reaction failed" });
  }
};

// ✏️ Edit post content
exports.editPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    post.content = req.body.content || post.content;
    await post.save();
    const updated = await post.populate("user", "name profilePic").populate("comments.user", "name profilePic");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
};

// ❌ Delete post
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await post.deleteOne();
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};
