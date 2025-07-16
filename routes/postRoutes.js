// routes/postRoutes.js
const express = require("express");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const auth = require("../middleware/authMiddleware");
const {
  getPosts,
  createPost,
  likePost,
  reactToPost,
  commentPost,
  editPost,
  deletePost
} = require("../src/api/posts/postController");

const router = express.Router();

// 🔄 Cloudinary storage config for image/video
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith("video/");
    return {
      folder: "posts",
      resource_type: isVideo ? "video" : "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "avi"],
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };
  },
});
const upload = multer({ storage });

// ✅ Routes
router.get("/", getPosts);
router.post("/", auth, upload.single("file"), createPost);
router.patch("/:id/like", auth, likePost);
router.patch("/:id/react", auth, reactToPost);
router.post("/:id/comment", auth, commentPost);
router.patch("/:id", auth, editPost);
router.delete("/:id", auth, deletePost);

module.exports = router;
