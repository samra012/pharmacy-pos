import axios from "axios";

const TOKEN_KEY = "pos_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// Attach the saved token to every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the backend says our session is no longer valid, clear it and tell the app.
// (A 401 from the login call itself just means a wrong password, so it's excluded.)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginCall = error.config?.url?.includes("/auth/login");
    if (error.response?.status === 401 && !isLoginCall) {
      clearToken();
      window.dispatchEvent(new Event("auth:logout"));
    }
    return Promise.reject(error);
  }
);

// Turns any API error into a plain, displayable message.
export function errorMessage(error, fallback = "Something went wrong.") {
  if (!error?.response) return "Can't reach the server. Is the backend running?";
  const detail = error.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return String(detail[0]?.msg || fallback).replace(/^Value error, /, "");
  }
  return fallback;
}

// ---------- Auth & staff ----------
export const login = (username, password) =>
  api.post("/auth/login", { username, password }).then((r) => r.data);
export const getMe = () => api.get("/auth/me").then((r) => r.data);
export const listUsers = () => api.get("/auth/users").then((r) => r.data);
export const createUser = (data) => api.post("/auth/users", data).then((r) => r.data);
export const updateUser = (id, data) => api.patch(`/auth/users/${id}`, data).then((r) => r.data);

// ---------- Products ----------
export const listProducts = () => api.get("/products/").then((r) => r.data);
export const getProduct = (id) => api.get(`/products/${id}`).then((r) => r.data);
export const createProduct = (data) => api.post("/products/", data).then((r) => r.data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data).then((r) => r.data);
export const deleteProduct = (id) => api.delete(`/products/${id}`);
export const addBatch = (productId, data) =>
  api.post(`/products/${productId}/batches`, data).then((r) => r.data);
export const listBatches = (productId) =>
  api.get(`/products/${productId}/batches`).then((r) => r.data);

// ---------- Sales ----------
export const checkout = (data) => api.post("/sales/", data).then((r) => r.data);
export const checkPrescriptions = (data) =>
  api.post("/sales/check-prescriptions", data).then((r) => r.data);
export const listSales = () => api.get("/sales/").then((r) => r.data);
export const getSale = (id) => api.get(`/sales/${id}`).then((r) => r.data);

// ---------- Reports ----------
export const dailySales = () => api.get("/reports/daily").then((r) => r.data);

export const topItems = (limit = 5) =>
  api.get("/reports/top-items", { params: { limit } }).then((r) => r.data);

export const lowStock = () => api.get("/reports/low-stock").then((r) => r.data);

export const nearExpiry = (days = 30) =>
  api.get("/reports/near-expiry", { params: { days } }).then((r) => r.data);

// ---------- Store settings ----------
export const getSettings = () => api.get("/settings/").then((r) => r.data);
export const updateSettings = (data) => api.put("/settings/", data).then((r) => r.data);

// ---------- Backups ----------
export const getBackups = () => api.get("/backups/").then((r) => r.data);
export const createBackupNow = () => api.post("/backups/").then((r) => r.data);

export default api;
