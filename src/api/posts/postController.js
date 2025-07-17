const Post = require("../../../models/Post");
const User = require("../../../models/User");
const cloudinary = require("../../../config/cloudinary");
const streamifier = require("streamifier");

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

const uploadToCloudinary = (buffer, folder, resource_type) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

const createPost = async (req, res) => {
  try {
    const { content } = req.body;
    let imageUrl = "", videoUrl = "";

    if (req.file) {
      const isVideo = req.file.mimetype.startsWith("video/");
      const uploadResult = await uploadToCloudinary(
        req.file.buffer,
        "posts",
        isVideo ? "video" : "image"
      );
      if (isVideo) videoUrl = uploadResult.secure_url;
      else imageUrl = uploadResult.secure_url;
    }

    if (!content && !imageUrl && !videoUrl) {
      return res.status(400).json({ message: "Post must contain content or media." });
    }

    const post = new Post({
      user: req.user._id,
      content,
      image: imageUrl,
      video: videoUrl,
    });

    await post.save();

    const populated = await post
      .populate("user", "name profilePic");

    req.io.emit("postCreated", populated);
    res.status(201).json(populated);
  } catch (err) {
    console.error("Post creation failed:", err);
    res.status(500).json({ message: "Failed to create post" });
  }
};

const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    res.json(posts);
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
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    post.content = req.body.content || post.content;
    await post.save();

    const updated = await post
      .populate("user", "name profilePic")
      .populate({ path: "comments.user", select: "name profilePic" })
      .populate({ path: "comments.replies.user", select: "name profilePic" });

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("Edit post error:", err);
    res.status(500).json({ message: "Failed to edit post" });
  }
};

const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
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
};
