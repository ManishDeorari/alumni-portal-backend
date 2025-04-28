const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  content: String,
  authorId: String,
  likes: [String],
  comments: [
    {
      userId: String,
      text: String,
      createdAt: Date,
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("Post", postSchema);
