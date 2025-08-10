const User = require("../../../../models/User");
const cloudinary = require("../../../../config/cloudinary");

module.exports = async (req, res) => {
  try {
    const { oldImageUrl, profileImage, ...rest } = req.body;

    // 🧹 Delete old Cloudinary image if present & not default
    if (oldImageUrl && oldImageUrl.includes("res.cloudinary.com")) {
      const publicId = extractPublicId(oldImageUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    }

    // ✅ Update user profile picture in DB
    const updates = {
      ...rest,
      profilePicture: profileImage, // map to DB field
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

// 🔍 Extract Cloudinary public ID
function extractPublicId(imageUrl) {
  try {
    const parts = imageUrl.split("/upload/");
    if (parts.length < 2) return null;
    const pathAndExt = parts[1];
    const noExt = pathAndExt.substring(0, pathAndExt.lastIndexOf("."));
    return noExt;
  } catch (e) {
    console.error("⚠️ Failed to extract public_id:", e.message);
    return null;
  }
}
