const app = require("./app");
const env = require("./config/env");
const connectDB = require("./config/db");

async function start() {
  await connectDB();

  app.listen(env.PORT, () => {
    console.log(`[server] InTime Attendance API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

start().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("[server] Unhandled rejection:", err);
});
