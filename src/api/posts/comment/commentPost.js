const Post = require("../../../../models/Post");
const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");

const commentPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const { text } = req.body;
    const userId = req.user._id;

    const comment = {
      user: userId,
      text,
      createdAt: new Date(),
    };

    // Add comment to post or event
    let post = await Post.findById(postId);
    let isEvent = false;

    if (!post) {
      post = await Event.findById(postId);
      if (post) isEvent = true;
    }

    if (!post) return res.status(404).json({ message: "Post/Event not found" });

    post.comments.push(comment);
    await post.save();

    let updatedPost;
    let plainPost;

    if (isEvent) {
      updatedPost = await Event.findById(postId)
        .populate("createdBy", "name profilePicture")
        .populate("comments.user", "name profilePicture")
        .populate("comments.replies.user", "name profilePicture");

      plainPost = updatedPost.toJSON();
      plainPost.user = plainPost.createdBy;
      plainPost.type = "Event";
      plainPost.content = plainPost.description;
      const regCount = await Registration.countDocuments({ eventId: postId });
      plainPost.registrationCount = regCount;
    } else {
      updatedPost = await Post.findById(postId)
        .populate("user", "name profilePicture")
        .populate("comments.user", "name profilePicture")
        .populate("comments.replies.user", "name profilePicture");
      plainPost = updatedPost.toJSON();
    }

    // Emit socket update
    if (req.io) {
      req.io.emit("postUpdated", plainPost);
    }

    // Trigger Notification if the commenter is not the post owner
    const receiverId = isEvent ? updatedPost.createdBy._id : updatedPost.user._id;
    if (userId.toString() !== receiverId.toString()) {
      const Notification = require("../../../../models/Notification");
      const newNotification = new Notification({
        sender: userId,
        receiver: receiverId,
        type: "post_comment",
        message: `${req.user.name} commented on your post: "${text.substring(0, 20)}${text.length > 20 ? "..." : ""}"`,
        postId: postId,
      });
      await newNotification.save();

      if (req.io) {
        const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
        req.io.to(receiverId.toString()).emit("newNotification", populatedNotification);
      }
    }

    // ✅ Award Points Logic (using User model and PointsSystemConfig)
    if (req.user.role === "alumni") {
      try {
        const User = require("../../../../models/User");
        const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
        const user = await User.findById(userId);
        const config = (await PointsSystemConfig.findOne()) || { commentPoints: 3 };

        if (!user.points) user.points = { total: 0 };
        const pts = config.commentPoints || 3;

        user.points.total = (user.points.total || 0) + pts;
        user.points.comments = (user.points.comments || 0) + pts;
        user.points.contentContribution = (user.points.contentContribution || 0) + pts;

        await user.save();
        console.log(`✅ Awarded ${pts} points to user ${user.name} for commenting.`);
      } catch (awardErr) {
        console.error("❌ Failed to award points for comment:", awardErr.message);
      }
    }

    // Return full updated post (✅ Only one response!)
    res.status(201).json(plainPost);
  } catch (error) {
    console.error("Comment error:", error.message);
    res.status(500).json({ message: "Failed to comment" });
  }
};

module.exports = commentPost;
