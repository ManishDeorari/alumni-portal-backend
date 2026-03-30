const Post = require("../../../../models/Post");
const Event = require("../../../../models/Event");

const editPost = async (req, res) => {
  try {
    const { content, title, images, video } = req.body;
    
    // 1. Try finding in Post model
    let document = await Post.findById(req.params.id);
    let isEvent = false;

    // 2. If not found, try Event model
    if (!document) {
      document = await Event.findById(req.params.id);
      if (document) {
        isEvent = true;
      }
    }

    if (!document) return res.status(404).json({ message: "Post/Event not found" });

    // 3. Authorization check
    const ownerId = isEvent ? document.createdBy.toString() : document.user.toString();
    if (ownerId !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    // 4. Update fields
    if (isEvent) {
      document.title = typeof title === "string" ? title.trim() : document.title;
      document.description = typeof content === "string" ? content.trim() : document.description;
    } else {
      document.content = typeof content === "string" ? content.trim() : document.content;
    }

    document.images = Array.isArray(images) ? images : document.images;
    document.video = video ?? document.video;

    await document.save();

    // 5. Populate and Emit
    let updatedDoc;
    if (isEvent) {
      updatedDoc = await Event.findById(document._id).populate("createdBy", "name profilePicture");
      // Map to "Post" format for frontend consistency
      const ev = updatedDoc.toObject();
      updatedDoc = { ...ev, content: ev.description, user: ev.createdBy, type: "Event" };
    } else {
      updatedDoc = await Post.findById(document._id)
        .populate("user", "name profilePicture")
        .populate({ path: "comments.user", select: "name profilePicture" })
        .populate({ path: "comments.replies.user", select: "name profilePicture" });
    }

    req.io.emit("postUpdated", updatedDoc);
    res.json(updatedDoc);
  } catch (err) {
    console.error("❌ Edit Post error:", err);
    res.status(500).json({ message: "Failed to update post" });
  }
};

module.exports = editPost;
