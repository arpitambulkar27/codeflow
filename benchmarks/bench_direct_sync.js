import http from "k6/http";
import { Trend, Counter } from "k6/metrics";

export const durationTrend = new Trend("direct_duration_ms");
export const errorCount = new Counter("failed_requests");
export const timeoutCount = new Counter("timeout_requests");

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
  code: "print('direct sync bench')",
});

export default function () {
  const t0 = Date.now();
  const res = http.post(`${BASE_URL}/api/run`, PAYLOAD, { headers: HEADERS, timeout: "12s" });
  const dur = Date.now() - t0;
  durationTrend.add(dur);

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      if (body.error && body.error.includes("Time Limit Exceeded")) {
        timeoutCount.add(1);
      }
    } catch (e) {}
  } else if (res.status === 0 || res.status === 408) {
    timeoutCount.add(1);
  } else {
    errorCount.add(1);
  }
}
