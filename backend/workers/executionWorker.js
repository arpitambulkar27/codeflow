// backend/workers/executionWorker.js
const { Worker } = require("bullmq");
const Redis = require("ioredis");
const { runCode } = require("../src/services/dockerService");

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
  const worker = new Worker(
    "code-execution",
    async (job) => {
      console.log(
        `⏳ [Worker] Processing Job ID: ${job.id} (${job.data.language})`
      );

      const { language, code, stdin, stdinInput, roomId, roomCode } = job.data;
      const targetStdin = stdinInput !== undefined ? stdinInput : stdin;
      const targetRoom = roomCode || roomId;

      // Execute code safely inside Docker container
      const result = await runCode({ language, code, stdin: targetStdin });

      return result;
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("completed", (job) => {
    console.log(`✅ [Worker] Job ID: ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ [Worker] Job ID: ${job.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    if (err.code === "ECONNREFUSED" || err.message?.includes("Connection is closed")) return;
    console.warn("⚠️ BullMQ Execution Worker Warning:", err.message);
  });

  return worker;
}

module.exports = { initExecutionWorker };
