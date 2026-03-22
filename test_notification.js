const mongoose = require("mongoose");

async function testSave() {
  try {
    const mongoUri = "mongodb+srv://ManishDeorari:ManDeo001@cluster0.kgk80.mongodb.net/alumni-portal-db?retryWrites=true&w=majority";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // We MUST use the ACTUAL model file to test its validation
    const Notification = require("./models/Notification");
    const User = require("./models/User");

    // Find some users to use as sender/receiver
    const user1 = await User.findOne();
    const user2 = await User.findOne({ _id: { $ne: user1._id } });

    if (!user1 || !user2) {
        console.log("Need at least 2 users in DB to test.");
        await mongoose.disconnect();
        return;
    }

    console.log(`Testing with sender ${user1._id} and receiver ${user2._id}`);

    const notification = new Notification({
        sender: user1._id,
        receiver: user2._id,
        type: "group_joined",
        message: 'Test group notification',
        groupId: user1._id // Just a placeholder ID for testing
    });

    try {
        const saved = await notification.save();
        console.log("SUCCESS! Saved notification:", saved._id);
    } catch (saveErr) {
        console.error("SAVE FAILED:", saveErr.message);
        if (saveErr.errors) {
            Object.keys(saveErr.errors).forEach(key => {
                console.error(`Field ${key}: ${saveErr.errors[key].message}`);
            });
        }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error("CATASTROPHIC ERROR:", err);
  }
}

testSave();
