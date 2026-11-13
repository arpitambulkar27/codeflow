// backend/src/services/metrics.js
const client = require("prom-client");

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (CPU, Memory, Event Loop Lag)
client.collectDefaultMetrics({ register, prefix: "codeworkspace_" });

// 1. HTTP Request Counter
const httpRequestCounter = new client.Counter({
  name: "codeworkspace_http_requests_total",
  help: "Total number of HTTP requests processed by CodeWorkspace backend",
  labelNames: ["method", "route", "status_code"],
});

// 2. Code Execution Duration Histogram (p50, p95, p99 latency)
const executionDurationHistogram = new client.Histogram({
  name: "codeworkspace_execution_duration_seconds",
  help: "Code execution duration inside Docker containers in seconds",
  labelNames: ["language", "status"],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// 3. Execution Failures Counter
const executionFailureCounter = new client.Counter({
  name: "codeworkspace_execution_failures_total",
  help: "Total number of code execution failures by language and reason",
  labelNames: ["language", "reason"],
});

// 4. Active WebSockets Connections Gauge
const activeSocketsGauge = new client.Gauge({
  name: "codeworkspace_active_socket_connections",
  help: "Number of active Socket.io room clients currently connected",
});

register.registerMetric(httpRequestCounter);
register.registerMetric(executionDurationHistogram);
register.registerMetric(executionFailureCounter);
register.registerMetric(activeSocketsGauge);

module.exports = {
  register,
  httpRequestCounter,
  executionDurationHistogram,
  executionFailureCounter,
  activeSocketsGauge,
};
