const Post = require("../../../models/Post");
const User = require("../../../models/User");
const cloudinary = require("cloudinary").v2;

// Reusable Notification
const notify = async (targetUserId, fromUserId, type, message) => {
  if (targetUserId.toString() === fromUserId.toString()) return;
  const user = await User.findById(targetUserId);
  if (!user) return;
  user.notifications.push({
    type,
    message,
    fromUser: fromUserId,
    createdAt: new Date(),
    read: false,
  });
  await user.save();
};

// ✅ Create Post
const createPost = async (req, res) => {
  try {
    const { content, images, video } = req.body;

    const hasContent = content?.trim()?.length > 0;
    const hasImages = Array.isArray(images) && images.length > 0;
    const hasVideo = video?.url;

    if (!hasContent && !hasImages && !hasVideo) {
      return res.status(400).json({ message: "Post must contain text or media." });
    }

    const post = new Post({
      user: req.user._id || req.user.id,
      content: hasContent ? content.trim() : "",
      images: hasImages ? images : [],
      video: hasVideo ? video : null,
    });

    await post.save();
    const populated = await post.populate("user", "name profilePic");
    req.io?.emit("postCreated", populated);
    res.status(201).json({ post: populated });

    console.log("🖼️ Received images:", images);
  } catch (err) {
    console.error("❌ Post creation failed:", err);
    res.status(500).json({ message: "Failed to create post" });
  }
};

// ✅ Get Posts
const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    const total = await Post.countDocuments();

    res.json({ posts, total });
  } catch (err) {
    console.error("❌ Fetch posts failed:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};

// ✅ Like Post
const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const userId = req.user._id.toString();
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!Array.isArray(post.likes)) post.likes = [];

    const alreadyLiked = post.likes.includes(userId);
    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id !== userId);
    } else {
      post.likes.push(userId);
      if (post.user.toString() !== userId) {
        await notify(post.user, userId, "like", `${req.user.name} liked your post`);
      }
    }

    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" })
      .lean();

    req.io.emit("postUpdated", updated);
    req.io.emit("postLiked", { postId: post._id, userId }); // 🔄 Real-time like animation support

    res.json(updated);
  } catch (err) {
    console.error("❌ Like failed:", { postId: req.params.id, user: req.user._id, error: err });
    res.status(500).json({ message: "Like action failed" });
  }
};

// ✅ Comment on Post
const commentPost = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "")
      return res.status(400).json({ message: "Comment text is required" });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({
      user: req.user._id,
      text: text.trim(),
      createdAt: new Date(),
    });

    if (post.user.toString() !== req.user._id.toString()) {
      await notify(post.user, req.user._id, "comment", `${req.user.name} commented on your post`);
    }

    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" })
      .lean();

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("❌ Comment failed:", err);
    res.status(500).json({ message: "Comment failed" });
  }
};

// ✅ Reply to Comment
const replyToComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.replies.push({
      user: req.user._id,
      text: text.trim(),
      createdAt: new Date(),
    });

    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" })
      .lean();

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("❌ Reply failed:", err);
    res.status(500).json({ message: "Reply failed" });
  }
};

// ✅ Delete Comment
const deleteComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    comment.remove();
    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" })
      .lean();

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("❌ Delete comment error:", err);
    res.status(500).json({ message: "Failed to delete comment" });
  }
};

// ✅ Edit Comment
const editComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    comment.text = text.trim();
    comment.editedAt = new Date();
    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" })
      .lean();

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("❌ Edit comment error:", err);
    res.status(500).json({ message: "Failed to edit comment" });
  }
};

// ✅ React to Post
const reactToPost = async (req, res) => {
  try {
    const { emoji, action } = req.body;
    const userId = req.user._id.toString();

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.reactions = new Map(Object.entries(post.reactions || {}));

    // Remove user from all emojis
    for (const [key, users] of post.reactions.entries()) {
      post.reactions.set(key, users.filter((id) => id !== userId));
    }

    if (action === "add") {
      const users = post.reactions.get(emoji) || [];
      post.reactions.set(emoji, [...users, userId]);

      if (post.user.toString() !== userId) {
        await notify(post.user, userId, "reaction", `${req.user.name} reacted ${emoji} to your post`);
      }
    } else if (action === "remove") {
      const users = post.reactions.get(emoji) || [];
      post.reactions.set(emoji, users.filter((id) => id !== userId));
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    // Clean up empty emojis
    for (const [emoji, users] of post.reactions.entries()) {
      if (users.length === 0) {
        post.reactions.delete(emoji);
      }
    }

    post.reactions = Object.fromEntries(post.reactions);
    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" })
      .lean();

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("❌ Reaction failed:", err);
    res.status(500).json({ message: "Reaction failed" });
  }
};


// ✅ Edit Post
const editPost = async (req, res) => {
  try {
    const { content, images, video } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    post.content = typeof content === "string" ? content.trim() : post.content;
    post.images = Array.isArray(images) ? images : post.images;
    post.video = video ?? post.video;

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    req.io.emit("postUpdated", updatedPost);
    res.json(updatedPost);
  } catch (err) {
    console.error("❌ Edit Post error:", err);
    res.status(500).json({ message: "Failed to update post" });
  }
};

// ✅ Delete Post
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    for (const image of post.images || []) {
      if (image.public_id) {
        try {
          await cloudinary.uploader.destroy(image.public_id, { resource_type: "image" });
        } catch (err) {
          console.error("❌ Image delete failed:", err.message);
        }
      }
    }

    if (post.video?.public_id) {
      const fallbackTypes = ["video", "raw", "auto"];
      for (const type of fallbackTypes) {
        try {
          const result = await cloudinary.uploader.destroy(post.video.public_id, {
            resource_type: type,
          });
          if (result.result === "ok") break;
        } catch (err) {
          console.error(`❌ Failed deleting video as ${type}:`, err.message);
        }
      }
    }

    await Post.findByIdAndDelete(req.params.id);

    // ✅ Emit event to all clients
    req.io.emit("postDeleted", { postId: req.params.id });
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("❌ Delete post error:", err);
    res.status(500).json({ message: "Failed to delete post" });
  }
};

module.exports = {
  createPost,
  getPosts,
  likePost,
  commentPost,
  replyToComment,
  deleteComment,
  editComment,
  reactToPost,
  editPost,
  deletePost,
};
