const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  createdAt: { type: Date, default: Date.now },
});

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  image: { type: String, default: "" },
  video: { type: String, default: "" },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [commentSchema],
  reactions: {
    type: Map,
    of: [mongoose.Schema.Types.ObjectId], // ✅ fixed
    default: () => new Map(),
  },
}, { timestamps: true });

// ✅ Optional index
postSchema.index({ user: 1, createdAt: -1 });

// ✅ Ensure string keys in Map
postSchema.pre("save", function (next) {
  if (this.reactions) {
    for (const [key, value] of this.reactions.entries()) {
      if (typeof key !== "string") {
        this.reactions.delete(key);
        this.reactions.set(String(key), value);
      }
    }
  }
  next();
});

module.exports = mongoose.model("Post", postSchema);
