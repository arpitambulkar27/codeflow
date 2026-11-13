const express = require("express");
const router = express.Router();
const { executionQueue } = require("../../queue");
const { runRateLimiter } = require("../middleware/rateLimiter");
const { protect } = require("../middleware/authMiddleware");

// Apply Auth Protection & Redis Sliding-Window Rate Limiter
router.post("/run", protect, runRateLimiter, async (req, res) => {
  const { language, code, stdin, stdinInput, roomId, roomCode } = req.body;

  const targetStdin = stdinInput !== undefined ? stdinInput : stdin;
  const targetRoom = roomCode || roomId;
  const userId = req.user?._id?.toString() || req.user?.id?.toString() || "anonymous";

  // Validation checks
  if (!language || typeof code !== "string") {
    return res
      .status(400)
      .json({ error: "Both 'language' and 'code' are required." });
  }

  if (code.length > 20000) {
    return res
      .status(400)
      .json({ error: "Code exceeds max length (20,000 chars)." });
  }

  try {
    const job = await executionQueue.add(
      "run",
      { language, code, stdin: targetStdin, roomId: targetRoom, userId },
      {
        removeOnComplete: { age: 300 },
        removeOnFail: { age: 300 },
      }
    );

    return res.status(202).json({
      status: "queued",
      jobId: job.id,
      message: "Job submitted to execution queue.",
    });
  } catch (err) {
    console.error("Code Execution Error:", err);
    return res.status(500).json({ error: "Failed to execute code." });
  }
});

// Polling endpoint: GET /api/run/status/:jobId
router.get("/run/status/:jobId", protect, async (req, res) => {
  const { jobId } = req.params;
  const currentUserId = req.user?._id?.toString() || req.user?.id?.toString();

  try {
    const job = await executionQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }

    // Security check: Only allow job creator to view status
    if (job.data.userId && job.data.userId !== currentUserId) {
      return res.status(404).json({ error: "Job not found." });
    }

    const state = await job.getState(); // 'waiting' | 'active' | 'completed' | 'failed'
    if (state === "completed") {
      const result = job.returnvalue || {};
      return res.status(200).json({
        state,
        status: "completed",
        stdout: result.stdout || "",
        stderr: result.stderr || result.error || "",
        output: result.output || result.stdout || result.stderr || result.error || "Program executed with no stdout output.",
      });
    }
    if (state === "failed") {
      return res.status(200).json({
        state,
        status: "failed",
        error: job.failedReason || "Execution failed.",
      });
    }
    return res.status(200).json({ state, status: state });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch job status." });
  }
});

module.exports = router;
