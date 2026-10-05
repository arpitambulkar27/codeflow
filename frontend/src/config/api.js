const rawBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
    ? "https://codeflow-m0l3.onrender.com"
    : "http://localhost:5000");

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");
