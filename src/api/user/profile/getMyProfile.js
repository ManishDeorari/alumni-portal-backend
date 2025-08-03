const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("❌ Error fetching user profile:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
