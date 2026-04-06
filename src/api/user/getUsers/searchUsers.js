const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const { q, role } = req.query;
    if (!q) {
      return res.json([]);
    }

    const query = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { publicId: { $regex: q, $options: "i" } },
        { enrollmentNumber: { $regex: q, $options: "i" } }
      ]
    };

    if (role) {
      query.role = role;
    }

    // Search by name, publicId or enrollmentNumber
    const users = await User.find(query)
    .select("name publicId enrollmentNumber profilePicture role")
    .limit(10);

    res.json(users);
  } catch (error) {
    console.error("❌ Error searching users:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
