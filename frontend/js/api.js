// js/api.js
const API = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:3000"
  : "https://api.miapp.com";

function getToken() {
  return localStorage.getItem("token");
}

function getPayload() {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    console.error("Token inválido:", e);
    return null;
  }
}

function isTokenValido() {
  const payload = getPayload();
  if (!payload) return false;
  const ahora = Math.floor(Date.now() / 1000);
  return payload.exp > ahora;
}

async function apiFetch(endpoint, options = {}) {
  const { auth = true } = options;
  const token = getToken();
  const headers = options.headers || {};

  if (auth && token) headers["Authorization"] = `Bearer ${token}`;
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(`${API}${endpoint}`, {
      credentials: "include",
      ...options,
      headers
    });

    const contentType = res.headers.get("content-type");
    const raw = await res.text();
    const data = contentType?.includes("application/json") ? JSON.parse(raw) : {};

    if (!res.ok) throw new Error(data.error || "Error desconocido");

    return data;
  } catch (err) {
    console.error("⛔ Error en la petición:", err);
    throw err;
  }
}
