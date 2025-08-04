const cloudinary = require("cloudinary").v2;
const User = require("../../../../models/User");

// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = async (req, res) => {
  try {
    const { oldImageUrl, ...updates } = req.body;

    // 🧹 Delete old Cloudinary image if it exists and is not default
    if (oldImageUrl && oldImageUrl.includes("cloudinary.com")) {
      const publicId = extractPublicId(oldImageUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    }

    // ✍️ Update user in DB
    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password");

    res.json(updatedUser);
  } catch (error) {
    console.error("❌ Error updating profile:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// 🧠 Public ID Extractor
function extractPublicId(imageUrl) {
  try {
    const parts = imageUrl.split("/upload/")[1].split(".")[0]; // more robust
    return parts;
  } catch (e) {
    console.error("⚠️ Failed to extract Cloudinary public ID:", e.message);
    return null;
  }
}
