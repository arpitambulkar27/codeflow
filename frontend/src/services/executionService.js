import axios from "axios";
import { API_BASE_URL } from "../config/api.js";

const wait = (ms, signal) => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error("aborted"));
    }
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new Error("aborted"));
        },
        { once: true }
      );
    }
  });
};

/**
 * Executes a code job through the BullMQ queue and polls status until completion.
 *
 * @param {Object} payload - { language, code, stdin, stdinInput, roomId, roomCode }
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal] - Abort controller signal for cancellation / unmount
 * @param {Function} [options.onStateChange] - Invoked only when state transitions ('waiting' -> 'active')
 * @param {number} [options.pollIntervalMs=500] - Polling cadence
 * @param {number} [options.timeoutMs=60000] - Hard timeout before giving up
 * @returns {Promise<Object>} Execution output data object
 */
export async function executeCodeJob(payload, options = {}) {
  const {
    signal,
    onStateChange,
    pollIntervalMs = 500,
    timeoutMs = 60000,
  } = options;

  // 1. Enqueue job via POST /api/run
  let postRes;
  try {
    postRes = await axios.post(`${API_BASE_URL}/api/run`, payload, {
      signal,
    });
  } catch (postErr) {
    if (
      signal?.aborted ||
      axios.isCancel(postErr) ||
      postErr.message === "aborted" ||
      postErr.name === "AbortError" ||
      postErr.name === "CanceledError"
    ) {
      throw postErr;
    }
    const status = postErr.response?.status;
    if (status === 401 || status === 403) {
      throw new Error("Session expired. Please log in again.");
    }
    throw postErr;
  }

  const jobId = postRes.data?.jobId;
  if (!jobId) {
    throw new Error(
      postRes.data?.error || "Failed to enqueue execution job: missing jobId."
    );
  }

  // 2. Poll GET /api/run/status/:jobId
  const startTime = Date.now();
  let lastReportedState = null;
  let consecutiveTransientErrors = 0;
  const MAX_CONSECUTIVE_TRANSIENT_ERRORS = 3;

  while (Date.now() - startTime < timeoutMs) {
    if (signal?.aborted) {
      throw new Error("aborted");
    }

    await wait(pollIntervalMs, signal);

    try {
      const statusRes = await axios.get(
        `${API_BASE_URL}/api/run/status/${jobId}`,
        { signal }
      );

      // Reset transient failure counter on any successful response
      consecutiveTransientErrors = 0;

      const data = statusRes.data;
      const currentState = data.state;

      // Only notify when state actually transitions
      if (currentState && currentState !== lastReportedState) {
        lastReportedState = currentState;
        if (typeof onStateChange === "function") {
          onStateChange(currentState);
        }
      }

      // Completed successfully
      if (data.status === "completed" || currentState === "completed") {
        return data;
      }

      // Terminal failure reported by worker
      if (data.status === "failed" || currentState === "failed") {
        const errorMsg =
          data.error || data.stderr || "Execution failed in sandbox.";
        const fatalErr = new Error(errorMsg);
        fatalErr.isJobFailure = true;
        fatalErr.jobData = data;
        throw fatalErr;
      }
    } catch (err) {
      // Propagation on abort
      if (
        signal?.aborted ||
        axios.isCancel(err) ||
        err.message === "aborted" ||
        err.name === "AbortError" ||
        err.name === "CanceledError"
      ) {
        throw err;
      }

      // Rethrow worker terminal failure immediately
      if (err.isJobFailure) {
        throw err;
      }

      const statusCode = err.response?.status;

      // 401 and 403 are fatal immediately
      if (statusCode === 401 || statusCode === 403) {
        throw new Error("Session expired. Please log in again.");
      }

      // 404 is fatal immediately ("job not found or expired")
      if (statusCode === 404) {
        throw new Error(
          err.response?.data?.error || "Job not found or expired."
        );
      }

      // Up to 3 consecutive transient errors (network, 429, 5xx) with backoff
      consecutiveTransientErrors += 1;
      if (consecutiveTransientErrors >= MAX_CONSECUTIVE_TRANSIENT_ERRORS) {
        const msg =
          err.response?.data?.error ||
          err.message ||
          "Network or server error during status polling.";
        throw new Error(
          `Execution status polling failed (${consecutiveTransientErrors} retries): ${msg}`
        );
      }

      // Short backoff before next poll attempt
      await wait(200 * consecutiveTransientErrors, signal);
    }
  }

  throw new Error(
    "Execution timed out in queue. The system is experiencing high load."
  );
}
