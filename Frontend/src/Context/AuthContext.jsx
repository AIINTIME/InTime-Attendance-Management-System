import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as authService from "../Services/authService";
import { setOnAuthExpired } from "../Services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    setOnAuthExpired(() => {
      clearSession();
    });
  }, [clearSession]);

  useEffect(() => {
    (async () => {
      try {
        const me = await authService.getMe();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const loginAsEmployee = async (email, password) => {
    const loggedInUser = await authService.employeeLogin(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const loginAsAdmin = async (email, password) => {
    const loggedInUser = await authService.adminLogin(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      clearSession();
    }
  };

  const updateUser = (patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, loginAsEmployee, loginAsAdmin, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
