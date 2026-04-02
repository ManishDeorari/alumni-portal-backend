const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    // Search by name or publicId
    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { publicId: { $regex: q, $options: "i" } },
        { enrollmentNumber: { $regex: q, $options: "i" } }
      ]
    })
    .select("name publicId enrollmentNumber profilePicture role")
    .limit(10);

    res.json(users);
  } catch (error) {
    console.error("❌ Error searching users:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
