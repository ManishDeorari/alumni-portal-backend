const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const authMiddleware = require("../../../middleware/authMiddleware");
const {
  getAllPosts,
  createPost,
  likePost,
  commentOnPost
} = require("./postController");

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: "djw8l0wxn",
  api_key: "766141813445555",
  api_secret: "47bXXvPOrHmD4YBh8KEXcmGRqNs",
});

// Multer + Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith("video/");
    return {
      folder: "posts",
      resource_type: isVideo ? "video" : "image", // ✅ dynamic type
      allowed_formats: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "avi"], // ✅ add video formats
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };
  },
});
const upload = multer({ storage });

// Routes
router.get("/", getAllPosts);
router.post("/", authMiddleware, createPost);
router.patch("/:id/like", authMiddleware, likePost);
router.post("/:id/comment", authMiddleware, commentOnPost);

module.exports = router;
