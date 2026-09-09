require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const connectDB = require("./src/config/db");
const { initSocket, closeSocket } = require("./src/config/socket");

connectDB();

const PORT = process.env.PORT || 5000;

// Express and Socket.IO share this single HTTP server: there is no second
// Express app and no second listener. The REST API is unaffected.
const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);

  closeSocket();
  server.close(() => process.exit(0));

  // Don't hang forever on lingering keep-alive connections.
  setTimeout(() => process.exit(1), 10000).unref();
};

["SIGINT", "SIGTERM"].forEach((signal) =>
  process.on(signal, () => shutdown(signal))
);
