const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Import MongoDB connection
const connectDB = require("./config/db");

// Import Worker, Middleware & Routes
const { initExecutionWorker } = require("../workers/executionWorker");
const errorHandler = require("./middleware/errorHandler");
const runRoutes = require("./routes/run");
const aiRoutes = require("./routes/ai");
const authRoutes = require("./routes/auth");
const workspaceRoutes = require("./routes/workspaces");
const problemRoutes = require("./routes/problems");
const metricsRoutes = require("./routes/metrics");
const telemetryRoutes = require("./routes/telemetry");
const { httpRequestCounter, activeSocketsGauge } = require("./services/metrics");

const app = express();
const server = http.createServer(app);

// Trust first proxy for accurate IP rate limiting behind proxies/load balancers
app.set("trust proxy", 1);

// Connect to MongoDB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Prometheus HTTP Request Duration Tracking Middleware
app.use((req, res, next) => {
  res.on("finish", () => {
    if (req.path !== "/metrics" && req.path !== "/health") {
      httpRequestCounter.inc({
        method: req.method,
        route: req.baseUrl + (req.route?.path || req.path),
        status_code: res.statusCode,
      });
    }
  });
  next();
});

// Health Check & Telemetry Routes
app.get("/health", (req, res) => res.json({ status: "ok", docker: "ready", timestamp: new Date() }));
app.use("/metrics", metricsRoutes);
app.use("/api/telemetry", telemetryRoutes);

// REST Routes
app.use("/api", runRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/problems", problemRoutes);

// Return JSON 404 for unhandled /api/* routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

// Serve Frontend Static Assets & SPA Fallback (for combined Node/Express deployment)
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health" || req.path === "/metrics") {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

// Centralized Error Handling Middleware
app.use(errorHandler);

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Set io on app so REST routes can emit socket events
app.set("io", io);

// In-memory active room participants & editor state
const roomUsers = new Map(); // roomId -> Map(socketId -> username)
const roomStates = new Map(); // roomId -> { code, language }

io.on("connection", (socket) => {
  activeSocketsGauge.inc();
  console.log(`🔌 [Socket.io] Client connected: ${socket.id}`);

  socket.on("join-room", ({ roomId, roomCode, username }) => {
    const targetRoom = roomId || roomCode;
    if (!targetRoom) return;

    socket.join(targetRoom);
    socket.roomId = targetRoom;
    socket.username = username || "Developer";

    if (!roomUsers.has(targetRoom)) {
      roomUsers.set(targetRoom, new Map());
    }
    const participants = roomUsers.get(targetRoom);
    participants.set(socket.id, socket.username);

    const userList = Array.from(participants.values());

    // Broadcast updated participant list to all clients in room
    io.to(targetRoom).emit("room-participants", {
      roomId: targetRoom,
      participants: userList,
      count: userList.length,
    });

    socket.to(targetRoom).emit("user-joined", {
      username: socket.username,
      socketId: socket.id,
      count: userList.length,
    });

    // If active room state exists, send initial code & language sync to joining socket
    if (roomStates.has(targetRoom)) {
      socket.emit("sync-initial-state", roomStates.get(targetRoom));
    }

    console.log(
      `👥 [Socket.io] User ${socket.username} (${socket.id}) joined room: ${targetRoom} [Count: ${userList.length}]`
    );
  });

  socket.on("code-change", ({ roomId, roomCode, code, language }) => {
    const targetRoom = roomId || roomCode;
    if (targetRoom) {
      const currentState = roomStates.get(targetRoom) || {};
      roomStates.set(targetRoom, { ...currentState, code: code !== undefined ? code : currentState.code, language: language || currentState.language });
      // Emit a single canonical event per change. Previously this also emitted a
      // duplicate "code-change" event, which caused the same update to be
      // processed twice on receiving clients (the second copy would race ahead
      // of the client's own codeRef update), adding an unnecessary echo/timing
      // risk on top of the client-side debounce guard.
      socket.to(targetRoom).emit("code-update", code);
    }
  });

  socket.on("language-change", ({ roomId, roomCode, language, code }) => {
    const targetRoom = roomId || roomCode;
    if (targetRoom) {
      const currentState = roomStates.get(targetRoom) || {};
      roomStates.set(targetRoom, { ...currentState, language, code: code !== undefined ? code : currentState.code });
      socket.to(targetRoom).emit("language-update", { language, code });
    }
  });

  socket.on("cursor-position", ({ roomId, roomCode, position }) => {
    const targetRoom = roomId || roomCode;
    if (targetRoom) {
      socket.to(targetRoom).emit("cursor-update", {
        username: socket.username,
        socketId: socket.id,
        position,
      });
    }
  });

  socket.on("disconnect", () => {
    activeSocketsGauge.dec();
    const roomId = socket.roomId;
    if (roomId && roomUsers.has(roomId)) {
      const participants = roomUsers.get(roomId);
      participants.delete(socket.id);
      if (participants.size === 0) {
        roomUsers.delete(roomId);
      } else {
        const userList = Array.from(participants.values());
        io.to(roomId).emit("room-participants", {
          roomId,
          participants: userList,
          count: userList.length,
        });
      }
    }
    console.log(`🔌 [Socket.io] Client disconnected: ${socket.id}`);
  });
});

initExecutionWorker(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 CodeWorkspace backend running on http://localhost:${PORT}`);
});

// Process-level Crash Prevention Handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Promise Rejection:", reason?.stack || reason?.message || reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Fatal Exception:", error?.stack || error?.message || error);
});
