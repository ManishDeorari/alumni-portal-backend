const Post = require("../../../../models/Post");
const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");

const editPost = async (req, res) => {
  try {
    const { content, title, images, video } = req.body;
    let post = await Post.findById(req.params.id);
    let isEvent = false;

    if (!post) {
      post = await Event.findById(req.params.id);
      if (post) isEvent = true;
    }

    if (!post) return res.status(404).json({ message: "Post/Event not found" });

    const ownerId = isEvent ? post.createdBy.toString() : post.user.toString();
    if (ownerId !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (isEvent) {
      post.description = typeof content === "string" ? content.trim() : post.description;
      if (title && typeof title === "string") {
        post.title = title.trim();
      }
    } else {
      post.content = typeof content === "string" ? content.trim() : post.content;
    }
    post.images = Array.isArray(images) ? images : post.images;
    post.video = video ?? post.video;

    await post.save();

    let plainPost;

    if (isEvent) {
      const updatedPost = await Event.findById(post._id)
        .populate("createdBy", "name profilePicture")
        .populate({ path: "comments.user", select: "name profilePicture" })
        .populate({ path: "comments.replies.user", select: "name profilePicture" });
      
      plainPost = updatedPost.toJSON();
      plainPost.user = plainPost.createdBy;
      plainPost.type = "Event";
      plainPost.content = plainPost.description;
      const regCount = await Registration.countDocuments({ eventId: post._id });
      plainPost.registrationCount = regCount;
    } else {
      const updatedPost = await Post.findById(post._id)
        .populate("user", "name profilePicture")
        .populate({ path: "comments.user", select: "name profilePicture" })
        .populate({ path: "comments.replies.user", select: "name profilePicture" });
      plainPost = updatedPost.toJSON();
    }

    if (req.io) {
      req.io.emit("postUpdated", plainPost);
    }
    res.json(plainPost);
  } catch (err) {
    console.error("❌ Edit Post error:", err);
    res.status(500).json({ message: "Failed to update post" });
  }
};

module.exports = editPost;
