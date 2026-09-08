const mongoose = require("mongoose");
const env = require("./env");

async function connectDB() {
  if (!env.MONGODB_URI) {
    console.error(
      "[db] MONGODB_URI is not set. Add it to Backend/.env before starting the server."
    );
    process.exit(1);
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName: "InTimeAttendance",
    });
    console.log(`[db] MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error(`[db] MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] MongoDB disconnected");
  });
}

module.exports = connectDB;
