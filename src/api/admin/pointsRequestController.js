const Post = require("../../../models/Post");
const User = require("../../../models/User");
const Notification = require("../../../models/Notification");

const getPendingPointsRequests = async (req, res) => {
  try {
    const posts = await Post.find({
      "announcementDetails.pointsRequested": true,
      "announcementDetails.pointsStatus": "pending"
    })
    .populate("user", "name profilePicture")
    .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch points requests" });
  }
};

const approvePointsRequest = async (req, res) => {
  const { postId } = req.params;
  const { action } = req.body; // 'approve' or 'reject'

  try {
    const post = await Post.findById(postId);
    if (!post || !post.announcementDetails) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (action === "reject") {
      post.announcementDetails.pointsStatus = "rejected";
      await post.save();
      return res.json({ message: "Points request rejected" });
    }

    if (action === "approve") {
      const winners = post.announcementDetails.winners || [];
      const awardResults = [];

      for (let winner of winners) {
        if (winner.userId) {
          const user = await User.findById(winner.userId);
          if (user) {
            const pointsToAward = parseInt(winner.points) || 0;
            
            if (!user.points) user.points = { total: 0 };
            user.points.total = (user.points.total || 0) + pointsToAward;
            
            // Add to 'other' category as designated in the User model
            if (user.points.other === undefined) user.points.other = 0;
            user.points.other += pointsToAward;

            await user.save();

            // Create Notification
            const newNotification = new Notification({
              sender: req.user._id,
              receiver: user._id,
              type: "points_earned",
              message: `Congratulations! You earned ${pointsToAward} points for being mentioned in ${post.user.name}'s announcement.`,
            });
            await newNotification.save();

            // Socket emit if possible (handled in controller usually if io is passed)
            if (req.io) {
              const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
              req.io.to(user._id.toString()).emit("newNotification", populatedNotification);
            }

            awardResults.push({ name: winner.name, status: "awarded", points: pointsToAward });
          } else {
            awardResults.push({ name: winner.name, status: "user_not_found" });
          }
        } else {
          awardResults.push({ name: winner.name, status: "skipped_no_user_match" });
        }
      }

      post.announcementDetails.pointsStatus = "approved";
      await post.save();

      return res.json({ message: "Points request approved and points awarded", results: awardResults });
    }

    res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    console.error("Points approval error:", error);
    res.status(500).json({ message: "Failed to process points request" });
  }
};

module.exports = {
  getPendingPointsRequests,
  approvePointsRequest
};
