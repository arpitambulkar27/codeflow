// backend/src/routes/telemetry.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const { redisConnection } = require("../../queue");

// @route   GET /api/telemetry
// @desc    Get live server & database telemetry stats for the Dashboard UI
router.get("/", async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
    const redisStatus = redisConnection && redisConnection.status === "ready" ? "Connected" : "Offline";

    const workspaceCount = await Workspace.countDocuments({});
    const memoryMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const uptimeSec = Math.floor(process.uptime());

    res.json({
      status: "ok",
      timestamp: new Date(),
      system: {
        nodeVersion: process.version,
        uptimeSeconds: uptimeSec,
        memoryUsageMB: memoryMB,
      },
      database: {
        mongoDB: mongoStatus,
        redis: redisStatus,
        totalWorkspaces: workspaceCount,
      },
    });
  } catch (error) {
    console.error("Telemetry Endpoint Error:", error.message);
    res.status(500).json({ error: "Failed to fetch telemetry metrics." });
  }
});

module.exports = router;
