const Post = require("../../../../models/Post");

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

module.exports = createPost;
