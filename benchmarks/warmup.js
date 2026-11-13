import http from "k6/http";
import { sleep } from "k6";

export const options = {
  vus: parseInt(__ENV.VUS || "10", 10),
  duration: __ENV.DURATION || "10s",
};

const BASE_URL = __ENV.TARGET_URL || "http://127.0.0.1:5000";
const JWT_TOKEN = __ENV.BENCH_TOKEN || __ENV.AUTH_TOKEN || "";

const HEADERS = {
  "Content-Type": "application/json",
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

const PAYLOAD = JSON.stringify({
  language: "javascript",
  code: "console.log('warmup');",
});

export default function () {
  const res = http.post(`${BASE_URL}/api/run`, PAYLOAD, { headers: HEADERS });
  if (res.status === 202) {
    try {
      const jobId = JSON.parse(res.body).jobId;
      for (let i = 0; i < 20; i++) {
        sleep(0.2);
        const poll = http.get(`${BASE_URL}/api/run/status/${jobId}`, { headers: HEADERS });
        if (poll.status === 200) {
          const body = JSON.parse(poll.body);
          if (body.state === "completed" || body.state === "failed") break;
        }
      }
    } catch (e) {}
  }
}
