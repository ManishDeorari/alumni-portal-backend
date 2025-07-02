const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");

// 📌 Utility: Add notification to user
const addNotification = async (userId, fromUserId, type, message) => {
  if (userId.toString() === fromUserId.toString()) return; // Don’t notify self

  const user = await User.findById(userId);
  user.notifications.push({
    type,
    message,
    fromUser: fromUserId,
  });
  await user.save();
};

// 📝 Create post (with optional image)
router.post("/", auth, async (req, res) => {
  const post = new Post({
    user: req.user.id,
    content: req.body.content,
    image: req.body.image || "", // Image URL from Cloudinary
  });
  const saved = await post.save();
  const populated = await saved.populate("user", "name profilePic");
  res.json(populated);
});

// 📥 Get all posts
router.get("/", async (req, res) => {
  const posts = await Post.find()
    .sort({ createdAt: -1 })
    .populate("user", "name profilePic")
    .populate("comments.user", "name profilePic");
  res.json(posts);
});

// 👍 Like/Unlike toggle
router.patch("/:id/like", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  const userId = req.user.id;
  const hasLiked = post.likes.includes(userId);

  if (hasLiked) {
    post.likes.pull(userId);
  } else {
    post.likes.push(userId);
    await addNotification(post.user, userId, "like", "liked your post");
  }

  await post.save();
  const updated = await post.populate("user", "name profilePic").populate("comments.user", "name profilePic");
  res.json(updated);
});

// 💬 Add comment
router.post("/:id/comment", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  post.comments.push({ user: req.user.id, text: req.body.text });
  await post.save();

  await addNotification(post.user, req.user.id, "comment", "commented on your post");

  const updated = await post.populate("user", "name profilePic").populate("comments.user", "name profilePic");
  res.json(updated);
});

// 🤯 Add/Change emoji reaction
router.patch("/:id/react", auth, async (req, res) => {
  const { emoji } = req.body;
  const userId = req.user.id;
  const post = await Post.findById(req.params.id);

  if (!post.reactions.has(emoji)) {
    post.reactions.set(emoji, []);
  }

  const emojiUsers = post.reactions.get(emoji).map((id) => id.toString());

  // Remove this user's reaction from all emojis
  for (const [key, users] of post.reactions.entries()) {
    post.reactions.set(
      key,
      users.filter((id) => id.toString() !== userId)
    );
  }

  // Add reaction to selected emoji
  if (!emojiUsers.includes(userId)) {
    post.reactions.get(emoji).push(userId);
    await addNotification(post.user, userId, "reaction", `reacted ${emoji} to your post`);
  }

  await post.save();
  const updated = await post.populate("user", "name profilePic").populate("comments.user", "name profilePic");
  res.json(updated);
});

// ✏️ Edit post content
router.patch("/:id", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (post.user.toString() !== req.user.id) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  post.content = req.body.content || post.content;
  await post.save();
  const updated = await post.populate("user", "name profilePic").populate("comments.user", "name profilePic");
  res.json(updated);
});

// ❌ Delete post
router.delete("/:id", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });

  if (post.user.toString() !== req.user.id) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  await post.deleteOne();
  res.json({ message: "Post deleted successfully" });
});

module.exports = router;
