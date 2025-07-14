const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");

// 📌 Utility: Add notification to user
const addNotification = async (userId, fromUserId, type, message) => {
  if (userId.toString() === fromUserId.toString()) return; // Skip self-notifications

  const user = await User.findById(userId);
  user.notifications.push({
    type,
    message,
    fromUser: fromUserId,
    createdAt: new Date(),
    read: false,
  });
  await user.save();
};

// 📝 Create post (text, image or video URLs)
router.post("/", auth, async (req, res) => {
  try {
    const { content, image = "", video = "" } = req.body;

    if (!content && !image && !video) {
      return res.status(400).json({ message: "Post must contain content or media." });
    }

    const post = new Post({
      user: req.user.id,
      content,
      image,
      video,
    });

    const saved = await post.save();
    const populated = await saved.populate("user", "name profilePic");
    res.status(201).json(populated);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: "Failed to create post" });
  }
});

// 📥 Get all posts
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");

    res.json(posts);
  } catch (err) {
    console.error("Fetch posts error:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

// 👍 Like/Unlike post
router.patch("/:id/like", auth, async (req, res) => {
  try {
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
    const updated = await post
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");
    res.json(updated);
  } catch (err) {
    console.error("Like post error:", err);
    res.status(500).json({ message: "Failed to like/unlike post" });
  }
});

// 💬 Add a comment
router.post("/:id/comment", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    post.comments.push({ user: req.user.id, text: req.body.text });

    await post.save();
    await addNotification(post.user, req.user.id, "comment", "commented on your post");

    const updated = await post
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");
    res.json(updated);
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ message: "Failed to comment" });
  }
});

// 😄 Add or remove emoji reaction 
router.patch("/:id/react", auth, async (req, res) => {
  try {
    const { emoji, action } = req.body;
    const userId = req.user.id;
    const post = await Post.findById(req.params.id);

    if (!post) return res.status(404).json({ message: "Post not found" });

    // Ensure post.reactions is a Map
    if (!(post.reactions instanceof Map)) {
      post.reactions = new Map(Object.entries(post.reactions || {}));
    }

    // Remove user from all previous emoji reactions
    for (const [key, users] of post.reactions.entries()) {
      post.reactions.set(
        key,
        users.filter((id) => id.toString() !== userId)
      );
    }

    // Handle add or remove
    const current = post.reactions.get(emoji) || [];

    if (action === "add") {
      if (!current.includes(userId)) {
        post.reactions.set(emoji, [...current, userId]);
        await addNotification(post.user, userId, "reaction", `reacted ${emoji} to your post`);
      }
    } else if (action === "remove") {
      const updatedList = current.filter((id) => id.toString() !== userId);
      if (updatedList.length > 0) {
        post.reactions.set(emoji, updatedList);
      } else {
        post.reactions.delete(emoji);
      }
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await post.save();

    let updated = await Post.findById(post._id)
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");

    // ✅ Convert to plain object for safe JSON return
    updated = updated.toObject();
    if (updated.reactions instanceof Map) {
      updated.reactions = Object.fromEntries(updated.reactions);
    }

    res.json(updated);
  } catch (err) {
    console.error("Emoji reaction error:", err);
    res.status(500).json({ message: "Failed to react to post" });
  }
});

// ✏️ Edit post content
router.patch("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    post.content = req.body.content || post.content;
    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate("comments.user", "name profilePic");

    res.json(updated);
  } catch (err) {
    console.error("Edit post error:", err);
    res.status(500).json({ message: "Failed to edit post" });
  }
});

// ❌ Delete post
router.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await post.deleteOne();
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Delete post error:", err);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

module.exports = router;
