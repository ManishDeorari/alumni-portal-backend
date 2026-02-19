const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const visitorId = req.user?.id;

    const user = await User.findById(targetUserId).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    // 🚀 Visit Tracking Logic
    if (visitorId && visitorId.toString() !== targetUserId.toString()) {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
      const yearStr = now.getFullYear().toString();   // YYYY

      // Ensure visitStats exists
      if (!user.visitStats) {
        user.visitStats = { totalVisits: 0, todayVisits: 0 };
      }
      if (!user.visitors) {
        user.visitors = [];
      }

      // Find if this visitor has been here before
      const visitorRecord = user.visitors.find(v => v.user && v.user.toString() === visitorId.toString());

      if (visitorRecord) {
        const lastVisit = new Date(visitorRecord.lastVisit);
        const lastVisitDay = lastVisit.toISOString().split("T")[0];
        const lastVisitYear = lastVisit.getFullYear().toString();

        let updated = false;

        // Is it a new day?
        if (lastVisitDay !== todayStr) {
          user.visitStats.todayVisits += 1;
          updated = true;
        }

        // Is it a new year?
        if (lastVisitYear !== yearStr) {
          user.visitStats.totalVisits += 1;
          updated = true;
        }

        if (updated) {
          visitorRecord.lastVisit = now;
          await User.updateOne(
            { _id: targetUserId, "visitors.user": visitorId },
            {
              $set: {
                "visitors.$.lastVisit": now,
                "visitStats.todayVisits": user.visitStats.todayVisits,
                "visitStats.totalVisits": user.visitStats.totalVisits
              }
            }
          );
        }
      } else {
        // First time visitor ever
        user.visitStats.todayVisits += 1;
        user.visitStats.totalVisits += 1;
        user.visitors.push({ user: visitorId, lastVisit: now });

        await user.save();

        // 🔔 Send Notification
        try {
          const Notification = require("../../../../models/Notification");
          const visitor = await User.findById(visitorId).select("name");
          const newNotification = new Notification({
            sender: visitorId,
            receiver: targetUserId,
            type: "profile_visit",
            message: `visited your profile.`,
          });
          await newNotification.save();
          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
            req.io.to(targetUserId.toString()).emit("newNotification", populatedNotification);
          }
        } catch (noteErr) {
          console.error("❌ Failed to send visit notification:", noteErr.message);
        }
      }
    }

    // ✅ Return the complete user object (already excluded password in select)
    // We can return the whole object now since we fixed the profile fetch earlier
    res.json(user);
  } catch (err) {
    console.error("❌ Error fetching public profile:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
