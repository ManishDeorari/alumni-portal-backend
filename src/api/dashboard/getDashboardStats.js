const User = require("../../../models/User");
const Post = require("../../../models/Post");

const getDashboardStats = async (req, res) => {
  try {
    const user = req.user;
    
    // 1. Community Stats (For ALL Users)
    const totalUsers = await User.countDocuments();
    
    // Fetch 5 random active user profile pictures
    const randomUsers = await User.aggregate([
      { $match: { profilePicture: { $exists: true, $ne: "" }, approved: true } },
      { $sample: { size: 5 } },
      { $project: { profilePicture: 1 } }
    ]);
    const randomAvatars = randomUsers.map(u => u.profilePicture);

    const communityStats = {
      totalUsers,
      randomAvatars
    };

    // 2. Admin Real-Time Metrics
    if (user.role === "admin" || user.isMainAdmin) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Logins today
      const loginsToday = await User.countDocuments({
        "visitStats.lastResetTodayVisitsAt": { $gte: today }
      });

      // Currently active (using last seen as proxy)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60000);
      const currentlyActive = await User.countDocuments({
        lastSeenPostsAt: { $gte: thirtyMinutesAgo }
      });

      // Posts today
      const postsToday = await Post.countDocuments({
        createdAt: { $gte: today }
      });

      // Points Given Today
      const pointsPostsToday = await Post.find({
        createdAt: { $gte: today },
        $or: [
          { pointsStatus: "approved" },
          { "announcementDetails.pointsStatus": "approved" },
          { "eventRepostDetails.pointsStatus": "approved" }
        ]
      }).select("pointsStatus pointsRequested announcementDetails.pointsStatus announcementDetails.winners eventRepostDetails.pointsStatus type");
      let pointsGivenToday = 0;
      for (const p of pointsPostsToday) {
         if (p.pointsStatus === "approved" && p.pointsRequested) pointsGivenToday += 5;
         if (p.eventRepostDetails?.pointsStatus === "approved") pointsGivenToday += 10;
         if (p.announcementDetails?.pointsStatus === "approved" && p.announcementDetails.winners) {
            for (const w of p.announcementDetails.winners) {
               pointsGivenToday += Number(w.points) || 0;
            }
         }
      }

      return res.json({
        communityStats,
        adminStats: {
          loginsToday,
          currentlyActive,
          postsToday,
          pointsGivenToday
        }
      });
    }

    return res.json({ communityStats });
    
  } catch (error) {
    console.error("❌ Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = getDashboardStats;
