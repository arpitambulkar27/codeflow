// backend/workers/executionWorker.js
const { Worker } = require("bullmq");
const Redis = require("ioredis");
const { runCode } = require("../src/services/codeExecution");
const { executionFailureCounter, executionDurationHistogram } = require("../src/services/metrics");

const redisOptions = {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy(times) {
    if (!process.env.REDIS_URL && !process.env.REDIS_HOST && times > 3) {
      return null;
    }
    return Math.min(times * 1000, 3000);
  },
};

function getCleanRedisUrl(raw) {
  if (!raw) return null;
  const matches = [...raw.matchAll(/(rediss?:\/\/[^\s"']+)/gi)];
  return matches.length > 0 ? matches[matches.length - 1][1] : raw.trim();
}

const cleanRedisUrl = getCleanRedisUrl(process.env.REDIS_URL);

const redisConnection = cleanRedisUrl
  ? new Redis(cleanRedisUrl, redisOptions)
  : new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: process.env.REDIS_PORT || 6379,
      ...redisOptions,
    });

redisConnection.on("error", (err) => {
  if (err.code === "ECONNREFUSED") return;
  console.error("❌ Redis Connection Error:", err.message);
});

function initExecutionWorker(io) {
  const concurrency = parseInt(process.env.EXEC_CONCURRENCY || "8", 10);
  console.log(`⚡ [Worker] Starting BullMQ Worker with concurrency = ${concurrency}`);

  const worker = new Worker(
    "code-execution",
    async (job) => {
      console.log(
        `⏳ [Worker] Processing Job ID: ${job.id} (${job.data.language})`
      );

      const { language, code, stdin, stdinInput, roomId, roomCode } = job.data;
      const targetStdin = stdinInput !== undefined ? stdinInput : stdin;
      const targetRoom = roomId || roomCode;

      const timer = executionDurationHistogram.startTimer({ language });

      // Execute code safely inside Docker container
      const result = await runCode({ language, code, stdin: targetStdin });
      const isError = Boolean(result.error || (result.stderr && result.stderr.trim() !== ""));
      timer({ status: isError ? "error" : "success" });

      if (result.error && result.error.includes("Time Limit Exceeded")) {
        executionFailureCounter.inc({ language, reason: "timeout" });
      } else if (isError) {
        executionFailureCounter.inc({ language, reason: "runtime_error" });
      }

      // Emit Socket.io result if room exists
      if (io && targetRoom) {
        io.to(targetRoom).emit("execution-result", {
          output: result.output || result.stdout,
          error: result.error || result.stderr,
        });
      }

      return result;
    },
    { connection: redisConnection, concurrency }
  );

  worker.on("completed", (job) => {
    console.log(`✅ [Worker] Job ID: ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ [Worker] Job ID: ${job.id} failed:`, err.message);
    executionFailureCounter.inc({
      language: job?.data?.language || "unknown",
      reason: "worker_failed",
    });
  });

  worker.on("error", (err) => {
    if (err.code === "ECONNREFUSED" || err.message?.includes("Connection is closed")) return;
    console.warn("⚠️ BullMQ Execution Worker Warning:", err.message);
  });

  return worker;
}

module.exports = { initExecutionWorker };
