const mongoose = require("mongoose");

// ===================== Points Schema (Alumni only) =====================
const PointsSchema = new mongoose.Schema({
  profileCompletion: { type: Number, default: 0 },
  studentEngagement: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },
  contentContribution: { type: Number, default: 0 },
  campusEngagement: { type: Number, default: 0 },
  innovationSupport: { type: Number, default: 0 },
  alumniParticipation: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
});

// ===================== Notification Schema =====================
const NotificationSchema = new mongoose.Schema({
  type: { type: String },
  message: { type: String },
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  date: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
});

// ===================== Main User Schema =====================
const UserSchema = new mongoose.Schema(
  {
    // Basic info
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },

    // Alumni-only field
    enrollmentNumber: { type: String },

    // Faculty-only field
    employeeId: { type: String },

    // Common optional profile fields
    bio: String,
    job: String,
    course: String,
    year: String,
    profilePicture: String,
    bannerImage: String,

    // Networking connections
    connections: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    sentRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Role & Permission
    role: {
      type: String,
      enum: ["alumni", "faculty", "admin"],
      default: "alumni",
    },
    isAdmin: {
      type: Boolean,
      default: false, // true if admin privileges
    },
    approved: {
      type: Boolean,
      default: false, // must be approved by admin
    },

    // Points (Alumni only)
    points: { type: PointsSchema, default: () => ({}) },

    // Notifications
    notifications: [NotificationSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
