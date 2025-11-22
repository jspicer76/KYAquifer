import axios from "axios";

// IMPORTANT:
// Codespaces forwards ports automatically. 
// When the backend runs on port 8000, Vite can reach it using the same domain.

const api = axios.create({
  baseURL: "http://localhost:8000",   // Codespaces maps localhost:8000 correctly
  timeout: 30000,
});

export { api };
