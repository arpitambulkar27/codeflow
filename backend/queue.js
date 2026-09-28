// backend/queue.js
const { Queue } = require("bullmq");
const Redis = require("ioredis");

// 1. Configure Redis Connection
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

redisConnection.on("connect", () => {
  console.log("⚡ Connected to Redis instance");
});

redisConnection.on("error", (err) => {
  if (err.code === "ECONNREFUSED") return;
  console.error("❌ Redis Connection Error:", err.message);
});

// 2. Initialize BullMQ Queue for Code Executions
const executionQueue = new Queue("code-execution", {
  connection: redisConnection,
});

executionQueue.on("error", (err) => {
  if (err.code === "ECONNREFUSED" || err.message?.includes("Connection is closed")) return;
  console.warn("⚠️ BullMQ Queue Warning:", err.message);
});

module.exports = { executionQueue, redisConnection };
