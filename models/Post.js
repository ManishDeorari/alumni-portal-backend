const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  createdAt: { type: Date, default: Date.now },
});

// ✅ Post schema with emoji reaction structure and improvements
const postSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    image: { type: String, default: "" },
    video: { type: String, default: "" },

    // 👍 Likes (simple list of userIds)
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // 💬 Comments (embedded with user reference)
    comments: [commentSchema],

    // 😄 Emoji Reactions
    reactions: {
      type: Map,
      of: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: {},
    },
  },
  { timestamps: true }
);

// ✅ Optional: Indexing for fast user-specific queries
postSchema.index({ user: 1, createdAt: -1 });

// ✅ Optional: Ensure emoji keys are stored as strings
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
