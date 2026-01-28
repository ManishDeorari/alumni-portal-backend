const Post = require("../../../../models/Post");

const createPost = async (req, res) => {
  try {
    const { content, images, video, type } = req.body;
    const userRole = req.user.role;
    const isAdmin = req.user.isAdmin;

    const hasContent = content?.trim()?.length > 0;
    const hasImages = Array.isArray(images) && images.length > 0;
    const hasVideo = video?.url;

    if (!hasContent && !hasImages && !hasVideo) {
      return res.status(400).json({ message: "Post must contain text or media." });
    }

    // Role-based validation for post type
    let finalType = "Regular";
    if (type && type !== "Regular") {
      if (type === "Session" && userRole === "alumni") {
        finalType = "Session";
      } else if (type === "Event" && (userRole === "faculty" || isAdmin)) {
        finalType = "Event";
      } else if (type === "Announcement" && isAdmin) {
        finalType = "Announcement";
      } else {
        return res.status(403).json({ message: `You are not authorized to create a post of type ${type}` });
      }
    }

    const post = new Post({
      user: req.user._id || req.user.id,
      content: hasContent ? content.trim() : "",
      images: hasImages ? images : [],
      video: hasVideo ? video : null,
      type: finalType,
    });

    await post.save();
    const populated = await post.populate("user", "name profilePicture");
    req.io?.emit("postCreated", populated);

    res.status(201).json({ post: populated });

    console.log("🖼️ Received images:", images);
  } catch (err) {
    console.error("❌ Post creation failed:", err);
    res.status(500).json({ message: "Failed to create post" });
  }
};

module.exports = createPost;
