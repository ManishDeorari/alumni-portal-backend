const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState >= 1) {
      console.log("⚡ MongoDB Already Connected");
      return;
    }
    
    await mongoose.connect(process.env.MONGO_URI, {
      //useNewUrlParser: true,
      //useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
