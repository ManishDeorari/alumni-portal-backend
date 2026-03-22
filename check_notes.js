const mongoose = require("mongoose");

async function checkNotifications() {
  try {
    const mongoUri = "mongodb+srv://ManishDeorari:ManDeo001@cluster0.kgk80.mongodb.net/alumni-portal-db?retryWrites=true&w=majority";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const Notification = mongoose.model("Notification", new mongoose.Schema({
        type: String,
        message: String,
        isRead: Boolean,
        createdAt: Date
    }));

    const notes = await Notification.find({ 
        type: { $in: ["group_joined", "group_added", "group_removed", "group_disbanded"] } 
    }).sort({ createdAt: -1 }).limit(10);

    if (notes.length === 0) {
        console.log("No group notifications found in DB.");
    } else {
        console.log("Found notifications:", JSON.stringify(notes, null, 2));
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
}

checkNotifications();
