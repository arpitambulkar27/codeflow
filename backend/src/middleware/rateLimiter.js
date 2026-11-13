// backend/src/middleware/rateLimiter.js
const { redisConnection } = require("../../queue");

// In-memory fallback tracking if Redis is offline
const memoryStore = new Map();

/**
 * Custom Sliding Window Rate Limiting Middleware
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default 60000ms / 1 min)
 * @param {number} options.maxRequests - Max allowed requests per window (default 10)
 * @param {string} options.message - Error message when rate limit is exceeded
 */
const createRateLimiter = ({
  windowMs = 60000,
  maxRequests = 10,
  message = "Too many requests. Please try again later.",
} = {}) => {
  return async (req, res, next) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const userId = req.user?._id?.toString() || ip;
    const key = `ratelimit:${req.baseUrl || req.path}:${userId}`;
    const now = Date.now();

    try {
      if (redisConnection && redisConnection.status === "ready") {
        // Redis Sliding Window Algorithm using ZSET
        const windowStart = now - windowMs;
        const pipeline = redisConnection.pipeline();
        pipeline.zremrangebyscore(key, 0, windowStart);
        pipeline.zadd(key, now, `${now}-${Math.random()}`);
        pipeline.zcard(key);
        pipeline.expire(key, Math.ceil(windowMs / 1000));

        const results = await pipeline.exec();
        const requestCount = results[2][1];

        res.setHeader("X-RateLimit-Limit", maxRequests);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - requestCount));

        if (requestCount > maxRequests) {
          res.setHeader("Retry-After", Math.ceil(windowMs / 1000));
          return res.status(429).json({
            error: message,
            limit: maxRequests,
            retryAfterSeconds: Math.ceil(windowMs / 1000),
          });
        }
        return next();
      }
    } catch (err) {
      console.warn("Redis Rate Limiter warning, falling back to memory store:", err.message);
    }

    // In-memory fallback
    let record = memoryStore.get(key);
    if (!record || now - record.startTime > windowMs) {
      record = { startTime: now, count: 1 };
    } else {
      record.count += 1;
    }
    memoryStore.set(key, record);

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - record.count));

    if (record.count > maxRequests) {
      const resetTimeSeconds = Math.ceil((record.startTime + windowMs - now) / 1000);
      res.setHeader("Retry-After", resetTimeSeconds);
      return res.status(429).json({
        error: message,
        limit: maxRequests,
        retryAfterSeconds: resetTimeSeconds,
      });
    }

    next();
  };
};

// Preset limiters for sensitive endpoints
const baseRunRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 10,  // Max 10 runs per minute
  message: "Rate limit exceeded: Max 10 code executions per minute allowed.",
});

const runRateLimiter = (req, res, next) => {
  // Relax rate limit ONLY for benchmarking when explicitly requested and not in production
  if (process.env.DISABLE_RUN_RATE_LIMIT === "true" && process.env.NODE_ENV !== "production") {
    return next();
  }
  return baseRunRateLimiter(req, res, next);
};

const aiRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 5,   // Max 5 AI reviews per minute
  message: "Rate limit exceeded: Max 5 AI reviews per minute allowed.",
});

const globalRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 120, // Max 120 requests per minute per IP
  message: "Global rate limit exceeded. Please slow down your requests.",
});

const authRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 15, // Max 15 auth requests per minute per IP
  message: "Too many authentication requests. Please wait a minute before trying again.",
});

const detailsRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 30, // Max 30 problem details proxy requests per minute
  message: "Rate limit exceeded: Max 30 problem detail requests per minute allowed.",
});

module.exports = {
  createRateLimiter,
  runRateLimiter,
  aiRateLimiter,
  globalRateLimiter,
  authRateLimiter,
  detailsRateLimiter,
};

