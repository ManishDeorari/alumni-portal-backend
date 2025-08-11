// /api/user/update.js
const User = require("../../../../models/User");
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

    // ✅ Update user profile picture in DB
    const updates = {
      ...rest,
      profilePicture: profileImage,
    };

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password");

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
