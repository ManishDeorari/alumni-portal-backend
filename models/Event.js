const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  location: { type: String },
  description: { type: String },
});

module.exports = mongoose.models.Event || mongoose.model("Event", EventSchema);
