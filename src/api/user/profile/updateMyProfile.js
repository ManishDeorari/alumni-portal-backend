// /api/user/update.js
const User = require("../../../../models/User");
const cloudinary = require("../../../../config/cloudinary");

module.exports = async (req, res) => {
  try {
    const { oldImageUrl, profileImage, bannerImage, ...rest } = req.body;

    // 🧹 Delete old Cloudinary image if present & not default
    if (oldImageUrl && oldImageUrl.includes("res.cloudinary.com") && !oldImageUrl.includes("default")) {
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

    // ✅ Update user profile/banner in DB
    const updates = {
      ...rest,
      ...(profileImage && { profilePicture: profileImage }),
      ...(bannerImage && { bannerImage: bannerImage }),s
    };

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password");

    res.json(updatedUser);
  } catch (error) {
    console.error("❌ Error updating profile/banner:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 🔍 Robust public_id extractor
function extractPublicId(imageUrl) {
  try {
    imageUrl = imageUrl.split("?")[0]; // remove query params
    const afterUpload = imageUrl.split("/upload/")[1];
    if (!afterUpload) return null;
    const noVersion = afterUpload.replace(/v\d+\//, ""); // remove version
    return noVersion.substring(0, noVersion.lastIndexOf(".")) || noVersion;
  } catch (e) {
    console.error("⚠️ Failed to extract public_id:", e.message);
    return null;
  }
}
