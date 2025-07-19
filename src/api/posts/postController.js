const Post = require("../../../models/Post");
const User = require("../../../models/User");
const cloudinary = require("cloudinary");

const notify = async (targetUserId, fromUserId, type, message) => {
  if (targetUserId.toString() === fromUserId.toString()) return;
  const user = await User.findById(targetUserId);
  user.notifications.push({
    type,
    message,
    fromUser: fromUserId,
    createdAt: new Date(),
    read: false,
  });
  await user.save();
};

const createPost = async (req, res) => {
  try {
    const { content, images, video } = req.body;

    // Check if at least one of content, images or video is present
    const hasContent = content?.trim();
    const hasImages = Array.isArray(images) && images.length > 0;
    const hasVideo = video?.trim();

    if (!hasContent && !hasImages && !hasVideo) {
      return res
        .status(400)
        .json({ message: "Post must contain text or media." });
    }

    // Create post with multiple images
    const post = new Post({
      user: req.user._id || req.user.id,
      content: hasContent ? content.trim() : "",
      images: hasImages ? images : [],   // ✅ handle array of images
      video: hasVideo ? video : "",
    });

    await post.save();
    const populated = await post.populate("user", "name profilePic");

    req.io?.emit("postCreated", populated);
    res.status(201).json({ post: populated });

    console.log("🖼️ Received images:", images); // ✅ good for debug
  } catch (err) {
    console.error("❌ Post creation failed:", err);
    res.status(500).json({ message: "Failed to create post" });
  }
};


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
    console.error("Fetch posts failed:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};

const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const userId = req.user._id.toString();
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!Array.isArray(post.likes)) post.likes = [];

    const liked = post.likes.includes(userId);
    if (liked) {
      post.likes = post.likes.filter((id) => id !== userId);
    } else {
      post.likes.push(userId);
      await notify(post.user, userId, "like", `${req.user.name} liked your post`);
    }

    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("Like failed:", err);
    res.status(500).json({ message: "Like action failed" });
  }
};

const commentPost = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "")
      return res.status(400).json({ message: "Comment text is required" });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({ user: req.user._id, text, createdAt: new Date() });
    await notify(post.user, req.user._id, "comment", `${req.user.name} commented on your post`);
    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("Comment failed:", err);
    res.status(500).json({ message: "Comment failed" });
  }
};

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

    comment.replies = comment.replies || [];
    comment.replies.push({
      user: req.user._id,
      text,
      createdAt: new Date(),
    });

    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("Reply failed:", err);
    res.status(500).json({ message: "Reply failed" });
  }
};

const deleteComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized to delete this comment" });
    }

    comment.remove();
    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ message: "Failed to delete comment" });
  }
};

// Add this inside postController.js
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
      return res.status(403).json({ message: "Unauthorized to edit this comment" });
    }

    comment.text = text;
    comment.editedAt = new Date();

    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("Edit comment error:", err);
    res.status(500).json({ message: "Failed to edit comment" });
  }
};

const reactToPost = async (req, res) => {
  try {
    const { emoji, action } = req.body;
    const userId = req.user._id.toString();
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!(post.reactions instanceof Map)) {
      post.reactions = new Map(Object.entries(post.reactions || {}));
    }

    for (const [key, users] of post.reactions.entries()) {
      post.reactions.set(
        key,
        users.filter((id) => id !== userId)
      );
    }

    if (action === "add") {
      const users = post.reactions.get(emoji) || [];
      post.reactions.set(emoji, [...users, userId]);
      await notify(post.user, userId, "reaction", `reacted ${emoji} to your post`);
    } else if (action === "remove") {
      const users = post.reactions.get(emoji) || [];
      const updatedUsers = users.filter((id) => id !== userId);
      if (updatedUsers.length > 0) {
        post.reactions.set(emoji, updatedUsers);
      } else {
        post.reactions.delete(emoji);
      }
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    post.reactions = Object.fromEntries(post.reactions);
    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("Reaction failed:", err);
    res.status(500).json({ message: "Reaction failed" });
  }
};

const editPost = async (req, res) => {
  try {
    const { content, images, video } = req.body;
    const postId = req.params.id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Ensure only the original poster can edit
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Update fields if provided
    if (typeof content === "string") post.content = content;
    if (Array.isArray(images)) post.images = images;
    if (typeof video === "string") post.video = video;

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    // Optional: Emit socket update
    if (req.io) {
      req.io.emit("postUpdated", updatedPost);
    }

    res.json(updatedPost);
  } catch (error) {
    console.error("❌ Edit Post Error:", error);
    res.status(500).json({ message: "Failed to update post" });
  }
};

const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // ✅ Delete images from Cloudinary
    if (post.images && post.images.length > 0) {
      for (const image of post.images) {
        if (image.public_id) {
          await cloudinary.uploader.destroy(image.public_id, {
            resource_type: "image",
          });
        }
      }
    }

    // ✅ Delete video from Cloudinary
    if (post.video && post.video.public_id) {
      await cloudinary.uploader.destroy(post.video.public_id, {
        resource_type: "video",
      });
    }

    await post.deleteOne();

    req.io.emit("postDeleted", { postId: req.params.id });
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Delete post error:", err);
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
  reactToPost,
  editPost,
  deletePost,
  editComment,
};
