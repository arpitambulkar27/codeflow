import http from "k6/http";
import { sleep } from "k6";
import { Trend, Counter } from "k6/metrics";

export const enqueueTrend = new Trend("enqueue_latency_ms");
export const e2eTrend = new Trend("e2e_latency_ms");
export const pollAttemptsTrend = new Trend("poll_attempts");
export const stderrCount = new Counter("stderr_output_jobs");
export const errorCount = new Counter("failed_jobs");
export const timeoutCount = new Counter("timeout_jobs");
export const longWaitCompletedCount = new Counter("long_wait_completed_jobs");

export const options = {
  vus: parseInt(__ENV.VUS || "50", 10),
  duration: __ENV.DURATION || "60s",
  summaryTrendStats: ["min", "avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const BASE_URL = __ENV.TARGET_URL || "http://127.0.0.1:5000";
const JWT_TOKEN = __ENV.BENCH_TOKEN || __ENV.AUTH_TOKEN || "";

const HEADERS = {
  "Content-Type": "application/json",
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

const PAYLOAD = JSON.stringify({
  language: "python",
  code: "print('k6 python bench test: ' + str(1 + 1))",
});

export default function () {
  const startE2E = Date.now();

  // 1. Post to enqueue
  const t0 = Date.now();
  const enqueueRes = http.post(`${BASE_URL}/api/run`, PAYLOAD, { headers: HEADERS });
  const enqueueDur = Date.now() - t0;
  enqueueTrend.add(enqueueDur);

  if (enqueueRes.status !== 202) {
    errorCount.add(1);
    sleep(0.2);
    return;
  }

  let jobId;
  try {
    const body = JSON.parse(enqueueRes.body);
    jobId = body.jobId;
  } catch (e) {
    errorCount.add(1);
    sleep(0.2);
    return;
  }

  if (!jobId) {
    errorCount.add(1);
    sleep(0.2);
    return;
  }

  // 2. Poll status with fixed 200ms interval
  let completed = false;
  let attempts = 0;
  const maxAttempts = 300; // 60s max polling timeout for heavy queue backlog

  while (!completed && attempts < maxAttempts) {
    attempts++;
    sleep(0.2);

    const statusRes = http.get(`${BASE_URL}/api/run/status/${jobId}`, { headers: HEADERS });

    if (statusRes.status === 404 || statusRes.status === 429 || statusRes.status >= 500) {
      errorCount.add(1);
      return;
    }

    if (statusRes.status !== 200) {
      errorCount.add(1);
      return;
    }

    let statusBody;
    try {
      statusBody = JSON.parse(statusRes.body);
    } catch (e) {
      errorCount.add(1);
      return;
    }

    if (statusBody.state === "completed" || statusBody.status === "completed") {
      completed = true;
      const totalDur = Date.now() - startE2E;

      if (
        (statusBody.error && statusBody.error.includes("Time Limit Exceeded")) ||
        (statusBody.stderr && statusBody.stderr.includes("Time Limit Exceeded"))
      ) {
        timeoutCount.add(1);
      } else {
        e2eTrend.add(totalDur);
        pollAttemptsTrend.add(attempts);

        if (totalDur >= 8000) {
          longWaitCompletedCount.add(1);
        }

        if (statusBody.stderr && statusBody.stderr.trim() !== "") {
          stderrCount.add(1);
        }
      }
      return;
    }

    if (statusBody.state === "failed" || statusBody.status === "failed") {
      completed = true;
      if (statusBody.error && statusBody.error.includes("Time Limit Exceeded")) {
        timeoutCount.add(1);
      } else {
        errorCount.add(1);
      }
      return;
    }
  }

  if (!completed) {
    errorCount.add(1);
  }
}
