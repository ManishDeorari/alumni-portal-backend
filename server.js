require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const pendingRoute = require("./routes/connect/pending");
const adminPointsRoutes = require("./routes/adminPointsRoutes");
const connectRequestRoute = require("./routes/connect/request");
const connectAcceptRoute = require("./routes/connect/accept");
const connectRejectRoute = require("./routes/connect/reject");
const connectListRoute = require("./routes/connect/list");

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: "https://alumni-frontend.vercel.app", // or "*"
  credentials: true,
}));

// Connect to MongoDB
connectDB();

// Health Check Route
app.get("/", (req, res) => {
  res.send("✅ API is running...");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/connect/pending", pendingRoute);
app.use("/api/admin", adminPointsRoutes);
app.use("/api/connect/request", connectRequestRoute);
app.use("/api/connect/accept", connectAcceptRoute);
app.use("/api/connect/reject", connectRejectRoute);
app.use("/api/connect/list", connectListRoute);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ message: "Server Error" });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
