import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch, getStoredToken } from "../lib/api.js";

const AuthContext = createContext(null);

function setStoredSession(token, user) {
  if (token) localStorage.setItem("lexintel_token", token);
  else localStorage.removeItem("lexintel_token");

  if (user) localStorage.setItem("lexintel_user", JSON.stringify(user));
  else localStorage.removeItem("lexintel_user");
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem("lexintel_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(Boolean(getStoredToken()));

  useEffect(() => {
    const restore = async () => {
      const token = getStoredToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await apiFetch("/auth/me");
        if (!response.ok) throw new Error("Session expired");
        const data = await response.json();
        setUser(data.user || null);
        setStoredSession(token, data.user || null);
      } catch {
        setUser(null);
        setStoredSession("", null);
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const login = async (emailOrPhone, password) => {
    const response = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ emailOrPhone, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Login failed");
    setUser(data.user);
    setStoredSession(data.token, data.user);
    return data.user;
  };

  const signup = async (payload) => {
    const response = await apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Signup failed");
    return data;
  };

  const logout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Clear client state even if backend logout fails.
    }
    setUser(null);
    setStoredSession("", null);
  };

  const refreshUser = async () => {
    const response = await apiFetch("/auth/me");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to refresh session");
    setUser(data.user || null);
    setStoredSession(getStoredToken(), data.user || null);
    return data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        isApprovedLawyer: Boolean(user?.role === "lawyer" && user?.verification_status === "approved"),
        isAdmin: Boolean(user?.role === "admin"),
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
