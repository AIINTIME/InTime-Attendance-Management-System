import axios from "axios";
import { API_URL } from "../Utils/constants";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let isRefreshing = false;
let pendingQueue = [];

function resolveQueue(error) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()));
  pendingQueue = [];
}

// Populated by AuthContext so the interceptor can force a logout/redirect
// without importing React context logic into this plain module.
let onAuthExpired = () => {
  window.location.href = "/";
};
export function setOnAuthExpired(handler) {
  onAuthExpired = handler;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (!response) {
      return Promise.reject(error);
    }

    const isAuthRoute =
      config.url?.includes("/auth/login") ||
      config.url?.includes("/auth/refresh") ||
      config.url?.includes("/auth/employee/login") ||
      config.url?.includes("/auth/admin/login");

    if (response.status === 401 && !config._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then(() => api(config));
      }

      config._retry = true;
      isRefreshing = true;

      try {
        await api.post("/auth/refresh");
        isRefreshing = false;
        resolveQueue(null);
        return api(config);
      } catch (refreshError) {
        isRefreshing = false;
        resolveQueue(refreshError);
        onAuthExpired();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
