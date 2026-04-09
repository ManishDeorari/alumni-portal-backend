require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const Group = require("../models/Group");
const connectDB = require("../config/db");

async function migrate() {
    try {
        await connectDB();
        console.log("🔄 Starting migration: Disabling Alumni Messaging for all groups...");
        
        const result = await Group.updateMany({}, { $set: { allowAlumniMessaging: false } });
        
        console.log(`✅ Migration complete. Updated ${result.modifiedCount} groups.`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
}

migrate();
