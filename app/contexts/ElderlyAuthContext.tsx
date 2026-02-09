"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";

interface ElderlyData {
  elderly_userid: string;
  preferred_name: string;
  admin_id: string;
  caregiver_assigned: string;
}

interface ElderlyAuthContextType {
  token: string | null;
  elderlyData: ElderlyData | null;
  isAuthenticated: boolean;
  login: (token: string, data: ElderlyData) => void;
  logout: () => void;
  refreshActivity: () => Promise<boolean>;
  lastActivity: Date | null;
  logoutWarning: string | null; // Warning message before auto-logout
}

const ElderlyAuthContext = createContext<ElderlyAuthContextType | undefined>(
  undefined
);

export const ElderlyAuthProvider = ({ children }: { children: ReactNode }) => {
  // Initialize state lazily from localStorage to avoid calling setState synchronously inside useEffect
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem("elderlyToken") ?? null;
    } catch {
      return null;
    }
  });

  const [elderlyData, setElderlyData] = useState<ElderlyData | null>(() => {
    try {
      const d = localStorage.getItem("elderlyData");
      return d ? (JSON.parse(d) as ElderlyData) : null;
    } catch {
      return null;
    }
  });

  const [lastActivity, setLastActivity] = useState<Date | null>(() => {
    try {
      const a = localStorage.getItem("elderlyLastActivity");
      return a ? new Date(a) : null;
    } catch {
      return null;
    }
  });

  const [tokenCreatedAt, setTokenCreatedAt] = useState<Date | null>(() => {
    try {
      const t = localStorage.getItem("elderlyTokenCreatedAt");
      return t ? new Date(t) : null;
    } catch {
      return null;
    }
  });

  const [logoutWarning, setLogoutWarning] = useState<string | null>(null);

  // API base URL state (load from /url.json, fallback to env/local)
  const [apiUrl, setApiUrl] = useState<string>(() => {
    try {
      return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    fetch("/url.json")
      .then((res) => res.json())
      .then((data) => {
        if (data.public_url) setApiUrl(data.public_url);
      })
      .catch((err) => {
        console.error("Failed to load API URL, using env/local:", err);
      });
  }, []);

  // Define logout first with useCallback to avoid dependency issues
  const logout = useCallback(() => {
    setToken(null);
    setElderlyData(null);
    setLastActivity(null);
    setTokenCreatedAt(null);
    setLogoutWarning(null);

    // Keep token in localStorage so expired token detection works on next "Start"
    // Only clear the context state variables and other data
    // localStorage.removeItem("elderlyToken"); // DON'T remove token
    localStorage.removeItem("elderlyData");
    localStorage.removeItem("elderlyLastActivity");
    localStorage.removeItem("elderlyTokenCreatedAt");
  }, []);

  // No need for an effect to load localStorage; state is initialized lazily above

  // Check inactivity and 24h timeout every 10 seconds
  useEffect(() => {
    if (!token || !lastActivity || !tokenCreatedAt) return;

    const checkExpiration = () => {
      const now = new Date();
      const inactiveMinutes =
        (now.getTime() - lastActivity.getTime()) / (1000 * 60);
      const tokenAgeHours =
        (now.getTime() - tokenCreatedAt.getTime()) / (1000 * 60 * 60);

      // Show warning at 14 minutes of inactivity
      if (inactiveMinutes >= 14 && inactiveMinutes < 15) {
        setLogoutWarning("Logging-out in 1 minute due to inactivity");
      }
      // Show warning at 23 hours
      else if (tokenAgeHours >= 23 && tokenAgeHours < 24) {
        setLogoutWarning("Logging-out in 1 minute");
      }
      // Force logout at 15 minutes inactivity
      else if (inactiveMinutes >= 15) {
        console.log("[ELDERLY AUTH] 15min inactivity detected, logging out");
        logout();
      }
      // Force logout at 24 hours
      else if (tokenAgeHours >= 24) {
        console.log("[ELDERLY AUTH] 24h token timeout, logging out");
        logout();
      }
      // Clear warning if still active
      else {
        setLogoutWarning(null);
      }
    };

    const interval = setInterval(checkExpiration, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [token, lastActivity, tokenCreatedAt, logout]);

  const login = (newToken: string, data: ElderlyData) => {
    setToken(newToken);
    setElderlyData(data);
    const now = new Date();
    setLastActivity(now);
    setTokenCreatedAt(now);
    setLogoutWarning(null);

    localStorage.setItem("elderlyToken", newToken);
    localStorage.setItem("elderlyData", JSON.stringify(data));
    localStorage.setItem("elderlyLastActivity", now.toISOString());
    localStorage.setItem("elderlyTokenCreatedAt", now.toISOString());
  };

  const refreshActivity = async (): Promise<boolean> => {
    if (!token) return false;

    try {
      const base =
        apiUrl ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://localhost:5000";
      const response = await fetch(`${base}/refresh_elderly_activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (result.success && result.new_token) {
        const now = new Date();
        setToken(result.new_token);
        setLastActivity(now);
        setLogoutWarning(null); // Clear any warnings on activity

        localStorage.setItem("elderlyToken", result.new_token);
        localStorage.setItem("elderlyLastActivity", now.toISOString());

        return true;
      } else {
        console.error(
          "[ELDERLY AUTH] Failed to refresh activity:",
          result.message
        );
        return false;
      }
    } catch (error) {
      console.error("[ELDERLY AUTH] Error refreshing activity:", error);
      return false;
    }
  };

  return (
    <ElderlyAuthContext.Provider
      value={{
        token,
        elderlyData,
        isAuthenticated: !!token,
        login,
        logout,
        refreshActivity,
        lastActivity,
        logoutWarning,
      }}
    >
      {children}
    </ElderlyAuthContext.Provider>
  );
};

export const useElderlyAuth = () => {
  const context = useContext(ElderlyAuthContext);
  if (!context) {
    throw new Error("useElderlyAuth must be used within ElderlyAuthProvider");
  }
  return context;
};
