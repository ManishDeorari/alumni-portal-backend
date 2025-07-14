const express = require("express");
const multer = require("multer");
const cloudinary = require("../../../config/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const authMiddleware = require("../../../middleware/authMiddleware");
const {
  getAllPosts,
  createPost,
  likePost,
  reactToPost,
  commentOnPost
} = require("./postController");

const router = express.Router();

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
router.post("/", authMiddleware, upload.single("file"), createPost); // Use 'file' as form field name
router.patch("/:id/like", authMiddleware, likePost);
router.post("/:id/comment", authMiddleware, commentPost);
// ✅ PATCH: Emoji Reaction (Like/Unlike with Emoji)
router.patch("/:postId/react", auth, reactToPost);
router.patch("/:id/like", auth, likeHandler);
router.patch("/:id/react", auth, reactHandler);

module.exports = router;
