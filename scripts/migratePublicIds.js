const mongoose = require("mongoose");
require("dotenv").config({ path: "../.env" });

const User = require("../models/User");

async function runMigration() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("🟢 Connected to MongoDB. Starting publicId migration...");

    // Find all users without a publicId
    const usersToUpdate = await User.find({ publicId: { $exists: false } });
    console.log(`Found ${usersToUpdate.length} users missing publicId.`);

    let updatedCount = 0;

    for (let user of usersToUpdate) {
      const baseSlug = (user.name || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      let publicId = baseSlug;
      let isUnique = false;
      let counter = 1;

      while (!isUnique) {
        // We must check if ANY user has this publicId
        const existing = await User.findOne({ publicId });
        if (existing && existing._id.toString() !== user._id.toString()) {
          publicId = `${baseSlug}-${counter}`;
          counter++;
        } else {
          isUnique = true;
        }
      }

      user.publicId = publicId;
      await user.save();
      console.log(`✅ Assigned publicId: @${publicId} to ${user.name}`);
      updatedCount++;
    }

    console.log(`\n🎉 Migration successfully completed. Updated ${updatedCount} users.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
