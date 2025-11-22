// src/api/client.js
import axios from "axios";

// Detect GitHub Codespace or local dev
const baseURL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname.includes("github.dev")
    ? "https://super-duper-tribble-74gwqjp95r6hp6pw-8000.app.github.dev"
    : "http://localhost:8000");

export const api = axios.create({
  baseURL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Optional: Log requests
api.interceptors.request.use((config) => {
  console.log("➡ API Request:", config.method, config.url, config.data);
  return config;
});

// Optional: Log responses
api.interceptors.response.use((res) => {
  console.log("⬅ API Response:", res.status, res.data);
  return res;
});
