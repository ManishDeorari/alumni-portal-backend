const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ Explicitly return profilePicture and other needed fields
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      enrollmentNumber: user.enrollmentNumber,
      profilePicture: user.profilePicture,
      bannerImage: user.bannerImage,
      whatsapp: user.whatsapp,
      linkedin: user.linkedin,
      connections: user.connections,
      // Add more fields if needed
    });
  } catch (error) {
    console.error("❌ Error fetching user profile:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
