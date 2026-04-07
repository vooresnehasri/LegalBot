const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export function getStoredToken() {
  return localStorage.getItem("lexintel_token") || "";
}

export async function apiFetch(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
}

export { API_BASE_URL };
