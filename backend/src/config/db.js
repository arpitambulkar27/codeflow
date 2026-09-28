// backend/src/config/db.js
const mongoose = require("mongoose");

mongoose.connection.on("error", (err) => {
  console.error(`⚠️ MongoDB Connection Error Event: ${err.message}`);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB Disconnected. Attempting auto-reconnect...");
});

const connectDB = async (retries = 5, delayMs = 3000) => {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/codeflow";

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(
        `❌ MongoDB Connection Attempt ${attempt}/${retries} Failed: ${error.message}`
      );
      if (attempt < retries) {
        console.log(`⏳ Retrying MongoDB connection in ${delayMs / 1000}s...`);
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        console.error(
          "⚠️ Maximum MongoDB connection retries reached. Server running without DB connection. Verify MONGO_URI in environment."
        );
      }
    }
  }
};

module.exports = connectDB;

