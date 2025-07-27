const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  createdAt: { type: Date, default: Date.now },
});

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  createdAt: { type: Date, default: Date.now },
  reactions: {
    type: Map,
    of: [mongoose.Schema.Types.ObjectId],
    default: {},
  },
  replies: [replySchema],
});

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  images: [
    {
      url: String,
      public_id: String,
    },
  ],
  video: {
    url: String,
    public_id: String,
  },
  //likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [commentSchema], // ✅ Corrected field
  reactions: {
    type: Map,
    of: [mongoose.Schema.Types.ObjectId],
    default: () => new Map(),
  },
}, { timestamps: true });

// ✅ Optional index
postSchema.index({ user: 1, createdAt: -1 });

// ✅ Ensure emoji keys only
const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Extended_Pictographic})$/u;

postSchema.pre("save", function (next) {
  if (this.reactions) {
    for (const [key, value] of this.reactions.entries()) {
      const strKey = String(key);
      if (!emojiRegex.test(strKey)) {
        this.reactions.delete(key); // remove non-emoji keys
        continue;
      }
      if (typeof key !== "string") {
        this.reactions.delete(key);
        this.reactions.set(strKey, value);
      }
    }
  }
  next();
});

postSchema.methods.toJSON = function () {
  const obj = this.toObject();
  if (obj.reactions instanceof Map) {
    obj.reactions = Object.fromEntries(obj.reactions);
  }
  return obj;
};

module.exports = mongoose.model("Post", postSchema);