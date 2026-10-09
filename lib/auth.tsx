"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { validatePasswordStrength } from "@/lib/auth-security";

export type UserRole = "admin" | "owner" | "agent" | "tenant";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  address?: string;
  gender?: string;
  birthdate?: string;
  country?: string;
  experience?: string;
  avatarUrl?: string;
  idVerificationUrl?: string;
  idVerificationStatus?: string;
  profileVisibility?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  allowMessages?: boolean;
  dataSharing?: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: Omit<User, "password"> | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string, role: UserRole, phone?: string, paymentPin?: string, address?: string) => Promise<boolean>;
  verifySignupOtp: (userId: string, otp: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  setUser: (user: Omit<User, "password"> | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = "renttrack_session";

export { SESSION_KEY };

async function apiCall(url: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await res.json();
    }
    const text = await res.text();
    return { success: false, error: text || `Server error (${res.status})` };
  } catch {
    return { success: false, error: "Network request failed" };
  }
}

async function apiGet(url: string) {
  try {
    const res = await fetch(url, { credentials: "include" });
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return { ...data, status: res.status };
    }
    return { success: false, transient: true, status: res.status };
  } catch {
    return { success: false, transient: true, status: 0 };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<Omit<User, "password"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setUser = useCallback((user: Omit<User, "password"> | null) => {
    setUserState(user);
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!localStorage.getItem(SESSION_KEY)) {
        setIsLoading(false);
        return;
      }

      try {
        const result = await apiGet("/api/auth/me");
        if (result.success) {
          setUserState(result.user);
          localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
        } else if (result.status === 401) {
          setUserState(null);
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        setUserState(null);
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [setUser]);

  useEffect(() => {
    if (!user) return;

    const heartbeat = window.setInterval(() => {
      void apiGet("/api/auth/me").catch(() => undefined);
    }, 60_000);

    return () => window.clearInterval(heartbeat);
  }, [user]);

  const signup = useCallback(
    async (name: string, email: string, password: string, role: UserRole, phone?: string, paymentPin?: string, address?: string): Promise<boolean> => {
      const strength = validatePasswordStrength(password);
      if (!strength.valid) {
        toast.error(`Password too weak: ${strength.errors.join(", ")}`);
        return false;
      }
      try {
        const result = await apiCall("/api/auth/signup", { name, email, password, role, phone, paymentPin, address });
        if (result.success) {
          if (result.needsOtp) {
            toast.success("Account created! Please verify your email.");
            return true;
          }
          toast.success("Account created successfully! Please log in.");
          return true;
        } else {
          toast.error(result.error || "Signup failed");
          return false;
        }
      } catch {
        toast.error("An error occurred. Please try again.");
        return false;
      }
    },
    []
  );

  const verifySignupOtp = useCallback(
    async (userId: string, otp: string): Promise<boolean> => {
      try {
        const result = await apiCall("/api/auth/signup/verify-otp", { userId, otp });
        if (result.success && result.verified) {
          toast.success("Email verified! You can now log in.");
          return true;
        } else {
          toast.error(result.error || "Verification failed");
          return false;
        }
      } catch {
        toast.error("An error occurred. Please try again.");
        return false;
      }
    },
    []
  );

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const result = await apiCall("/api/auth/login", { email, password });
        if (result.success) {
          setUserState(result.user);
          localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
          toast.success(`Welcome back, ${result.user.name}!`);
          return true;
        } else {
          toast.error(result.error || "Invalid email or password");
          return false;
        }
      } catch {
        toast.error("An error occurred. Please try again.");
        return false;
      }
    },
    [setUser]
  );

  const logout = useCallback(() => {
    setUserState(null);
    localStorage.removeItem(SESSION_KEY);
    return fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
  }, [setUser]);

  const profileChannel = typeof window !== "undefined" ? new BroadcastChannel("renttrack-profile-updates") : null;

  const refreshUser = useCallback(async () => {
    try {
      const result = await apiGet("/api/auth/me");
      if (result.success) {
        setUserState(result.user);
        localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
      } else if (result.status === 401) {
        setUserState(null);
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
    }
  }, [setUser]);

  useEffect(() => {
    if (!profileChannel) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "profile-updated") {
        window.dispatchEvent(new Event("renttrack-profile-updated"));
      }
    };
    profileChannel.addEventListener("message", handler);
    return () => profileChannel.removeEventListener("message", handler);
  }, [profileChannel]);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === SESSION_KEY && event.newValue) {
        window.dispatchEvent(new Event("renttrack-profile-updated"));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        verifySignupOtp,
        logout,
        isLoading,
        isAuthenticated: !!user,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
