require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

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
const server = http.createServer(app);

// ✅ Use the port Render provides
const PORT = process.env.PORT || 5000;

// ✅ CORS Configuration
const allowedOrigins = [
  "https://alumni-portal-frontend-khaki.vercel.app",
  "https://alumni-frontend.vercel.app",
  "https://alumni-portal-frontend-git-main-manishdeoraris-projects.vercel.app",
  "https://alumni-portal-frontend-70ml39lrm-manishdeoraris-projects.vercel.app",
  "https://alumni-portal-frontend-manishdeoraris-projects.vercel.app",
  "http://localhost:3000",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const io = new Server(server, {
  cors: corsOptions,
});

// ✅ Connect to MongoDB
console.log("📡 Attempting MongoDB connection...");
connectDB();

// ✅ Inject `io` into every request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ✅ Handle socket events
io.on("connection", (socket) => {
  console.log("📡 New socket connection:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// ✅ Middleware
console.log("🟢 Middleware setup...");
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb", parameterLimit: 50000 }));
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ✅ Health Check Route
app.get("/", (req, res) => {
  res.send("✅ API is running...");
});

// ✅ Routes
console.log("🔁 Route setup...");
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/connect/pending", pendingRoute);
app.use("/api/admin", adminPointsRoutes);
app.use("/api/connect/request", connectRequestRoute);
app.use("/api/connect/accept", connectAcceptRoute);
app.use("/api/connect/reject", connectRejectRoute);
app.use("/api/connect/list", connectListRoute);

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ message: "Server Error" });
});

// ✅ Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
