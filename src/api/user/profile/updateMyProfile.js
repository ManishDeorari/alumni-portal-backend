const User = require("../../../../models/User");
const cloudinary = require("../../../../config/cloudinary");

module.exports = async (req, res) => {
  try {
    const { oldImageUrl, profileImage, ...rest } = req.body;

    // 🧹 Delete old Cloudinary image if present
    if (oldImageUrl && oldImageUrl.includes("cloudinary.com")) {
      const publicId = extractPublicId(oldImageUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    }

    // ✅ Update correct field in DB
    const updates = {
      ...rest,
      profilePicture: profileImage, // 🔁 Map profileImage to profilePicture
    };

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password");

    res.json(updatedUser);
  } catch (error) {
    console.error("❌ Error updating profile:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// 🧠 Extract Cloudinary public ID from URL
function extractPublicId(imageUrl) {
  try {
    const parts = imageUrl.split("/upload/")[1].split(".")[0];
    return parts;
  } catch (e) {
    console.error("⚠️ Failed to extract Cloudinary public ID:", e.message);
    return null;
  }
}
