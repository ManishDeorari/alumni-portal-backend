const mongoose = require("mongoose");

const PointsSchema = new mongoose.Schema({
  profileCompletion: { type: Number, default: 0 },
  studentEngagement: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },
  contentContribution: { type: Number, default: 0 },
  campusEngagement: { type: Number, default: 0 },
  innovationSupport: { type: Number, default: 0 },
  alumniParticipation: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
});

const NotificationSchema = new mongoose.Schema({
  type: { type: String }, // e.g., 'connect', 'message'
  message: { type: String },
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  date: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false }
});

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  enrollmentNumber: { type: String, unique: true },
  bio: String,
  job: String,
  course: String,
  year: String,
  profilePicture: String,
  bannerImage: String,

  connections: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  sentRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  points: { type: PointsSchema, default: () => ({}) },
  role: { type: String, enum: ["user", "admin"], default: "user" },

  notifications: [NotificationSchema]
});

module.exports = mongoose.model("User", UserSchema);
