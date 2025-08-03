const jwt = require("jsonwebtoken");
const User = require("../models/User"); // ✅ Make sure this is correct

module.exports = async function (req, res, next) {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");

    // ✅ Fetch full user from DB
    const user = await User.findById(decoded.id || decoded._id).select("name profilePic");
    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    return res.status(401).json({ message: "Token is not valid" });
  }
};
