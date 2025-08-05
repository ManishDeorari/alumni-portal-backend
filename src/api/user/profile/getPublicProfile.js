const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    // 🧠 Return essential public profile fields
    res.json({
      _id: user._id,
      name: user.name,
      bio: user.bio,
      job: user.job,
      course: user.course,
      year: user.year,
      profilePicture: user.profilePicture, // ✅ Correct field
      bannerImage: user.bannerImage,
      linkedin: user.linkedin,
      whatsapp: user.whatsapp,
      connections: user.connections,
    });
  } catch (err) {
    console.error("❌ Error fetching public profile:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
