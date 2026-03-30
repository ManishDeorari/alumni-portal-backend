const Post = require("../../../../models/Post");
const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    let post = await Post.findById(id);
    let isEvent = false;

    if (!post) {
      post = await Event.findById(id);
      if (post) isEvent = true;
    }

    if (!post) return res.status(404).json({ error: "Post not found" });

    if (!(post.reactions instanceof Map)) {
      post.reactions = new Map(Object.entries(post.reactions || {}));
    }

    let userAlreadyReacted = false;

    for (const [key, users] of post.reactions.entries()) {
      const filtered = users.filter(id => id.toString() !== userId);
      if (key === emoji && filtered.length !== users.length) {
        userAlreadyReacted = true;
      }
      post.reactions.set(key, filtered);
    }

    if (!userAlreadyReacted) {
      const current = post.reactions.get(emoji) || [];
      if (!current.includes(userId)) {
        post.reactions.set(emoji, [...current, userId]);
      }
    }

    await post.save();

    let updatedPost;
    let plainPost;

    if (isEvent) {
      updatedPost = await Event.findById(post._id)
        .populate({ path: "createdBy", select: "name profilePicture" })
        .populate({
          path: "comments",
          populate: [
            { path: "user", select: "name profilePicture" },
            { path: "replies.user", select: "name profilePicture" },
          ],
        });
      
      plainPost = updatedPost.toJSON();
      plainPost.user = plainPost.createdBy;
      plainPost.type = "Event";
      plainPost.content = plainPost.description;
      const regCount = await Registration.countDocuments({ eventId: post._id });
      plainPost.registrationCount = regCount;
    } else {
      updatedPost = await Post.findById(post._id)
        .populate({ path: "user", select: "name profilePicture" })
        .populate({
          path: "comments",
          populate: [
            { path: "user", select: "name profilePicture" },
            { path: "replies.user", select: "name profilePicture" },
          ],
        });
      plainPost = updatedPost.toJSON();
    }

    if (req.io) {
      req.io.emit("postReacted", plainPost);
    }

    // ✅ Award Points Logic (if it's a NEW reaction)
    if (!userAlreadyReacted && req.user.role === "alumni") {
      try {
        const User = require("../../../../models/User");
        const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
        const user = await User.findById(userId);
        const config = (await PointsSystemConfig.findOne()) || { likePoints: 2 };

        if (!user.points) user.points = { total: 0 };
        const pts = config.likePoints || 2;

        user.points.total = (user.points.total || 0) + pts;
        user.points.likes = (user.points.likes || 0) + pts;
        user.points.studentEngagement = (user.points.studentEngagement || 0) + pts;

        await user.save();
        console.log(`✅ Awarded ${pts} points to user ${user.name} for reacting.`);
      } catch (awardErr) {
        console.error("❌ Failed to award points for reaction:", awardErr.message);
      }
    }

    // Trigger Notification if the reactor is not the post owner
    const receiverId = isEvent ? updatedPost.createdBy._id : updatedPost.user._id;
    if (userId !== receiverId.toString()) {
      const Notification = require("../../../../models/Notification");
      const newNotification = new Notification({
        sender: userId,
        receiver: receiverId,
        type: "post_like",
        message: `${req.user.name} reacted with ${emoji} to your post`,
        postId: id,
      });
      await newNotification.save();

      if (req.io) {
        const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
        req.io.to(receiverId.toString()).emit("newNotification", populatedNotification);
      }
    }

    res.status(200).json(plainPost);
  } catch (error) {
    console.error("🔥 Reaction error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};
