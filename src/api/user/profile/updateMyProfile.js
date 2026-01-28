const User = require("../../../../models/User");
const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
const cloudinary = require("../../../../config/cloudinary");

module.exports = async (req, res) => {
  try {
    const { oldImageUrl, profileImage, ...rest } = req.body;

    // 🧹 Delete old Cloudinary image if present & not default
    if (
      oldImageUrl &&
      oldImageUrl.includes("res.cloudinary.com") &&
      !oldImageUrl.includes("default-profile.jpg")
    ) {
      const publicId = extractPublicId(oldImageUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(`🗑 Deleted old Cloudinary image: ${publicId}`);
        } catch (err) {
          console.error("❌ Failed to delete old image from Cloudinary:", err);
        }
      }
    }

    // ✅ Update user profile picture in DB only if provided
    const updates = {
      ...rest,
    };
    if (profileImage) {
      updates.profilePicture = profileImage;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password");

    // ✅ Award Points Logic (if profile is "completed")
    // For simplicity, we award points on the first detailed update if not already awarded
    if (updatedUser.role === "alumni" && !updatedUser.profileCompletionAwarded) {
      const config = await PointsSystemConfig.findOne() || { profileCompletionPoints: 50 };

      // Simple check: if they filled some bio or address or education
      const isDetailed = updatedUser.bio || updatedUser.address || (updatedUser.education && updatedUser.education.length > 0);

      if (isDetailed) {
        if (!updatedUser.points) updatedUser.points = { total: 0 };
        updatedUser.points.total = (updatedUser.points.total || 0) + (config.profileCompletionPoints || 50);

        if (updatedUser.points.profileCompletion === undefined) updatedUser.points.profileCompletion = 0;
        updatedUser.points.profileCompletion += (config.profileCompletionPoints || 50);

        updatedUser.profileCompletionAwarded = true;
        await updatedUser.save();
        console.log(`✅ Awarded ${config.profileCompletionPoints} points to user ${updatedUser.name} for profile completion.`);
      }
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 🔍 More robust extractPublicId
function extractPublicId(imageUrl) {
  try {
    // Remove query params
    imageUrl = imageUrl.split("?")[0];

    // Find the part after /upload/
    const afterUpload = imageUrl.split("/upload/")[1];
    if (!afterUpload) return null;

    // Remove any version number like /v123456/
    const noVersion = afterUpload.replace(/v\d+\//, "");

    // Remove file extension
    return noVersion.substring(0, noVersion.lastIndexOf(".")) || noVersion;
  } catch (e) {
    console.error("⚠️ Failed to extract public_id:", e.message);
    return null;
  }
}