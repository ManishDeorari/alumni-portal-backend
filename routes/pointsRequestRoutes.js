const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const { getPendingPointsRequests, approvePointsRequest } = require("../src/api/admin/pointsRequestController");

const verifyAdmin = async (req, res, next) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied. Admins only." });
  next();
};

router.get("/pending", auth, verifyAdmin, getPendingPointsRequests);
router.patch("/:postId/action", auth, verifyAdmin, approvePointsRequest);

module.exports = router;
