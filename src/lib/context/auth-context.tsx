"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  plan: "free" | "plus" | "ultra";
  isAdmin: boolean;
  avatar?: string;
  joinedAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoggedIn: boolean;
}

interface StoredUser extends AuthUser {
  password: string;
}

const USERS_KEY = "goo-users";
const CURRENT_USER_KEY = "goo-user";

const MOCK_USERS: StoredUser[] = [
  {
    id: "u-001",
    name: "Elise Hartmann",
    email: "elise@example.com",
    password: "password123",
    plan: "ultra",
    isAdmin: false,
    joinedAt: "2024-03-12",
  },
  {
    id: "u-002",
    name: "Jonas Brenner",
    email: "jonas@example.com",
    password: "password123",
    plan: "plus",
    isAdmin: false,
    joinedAt: "2024-05-08",
  },
  {
    id: "u-003",
    name: "Maren Solis",
    email: "maren@example.com",
    password: "password123",
    plan: "free",
    isAdmin: false,
    joinedAt: "2024-07-21",
  },
  {
    id: "u-004",
    name: "Theo Vance",
    email: "theo@example.com",
    password: "password123",
    plan: "plus",
    isAdmin: false,
    joinedAt: "2024-09-03",
  },
  {
    id: "u-005",
    name: "Lena Kroft",
    email: "lena@example.com",
    password: "password123",
    plan: "ultra",
    isAdmin: false,
    joinedAt: "2024-11-17",
  },
];

function initUsers(): StoredUser[] {
  if (typeof window === "undefined") return MOCK_USERS;
  try {
    const stored = localStorage.getItem(USERS_KEY);
    if (stored) {
      return JSON.parse(stored) as StoredUser[];
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(MOCK_USERS));
    return MOCK_USERS;
  } catch {
    return MOCK_USERS;
  }
}

function getUsers(): StoredUser[] {
  if (typeof window === "undefined") return MOCK_USERS;
  try {
    const stored = localStorage.getItem(USERS_KEY);
    return stored ? (JSON.parse(stored) as StoredUser[]) : MOCK_USERS;
  } catch {
    return MOCK_USERS;
  }
}

function saveUsers(users: StoredUser[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {}
}

function stripPassword(user: StoredUser): AuthUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...rest } = user;
  return rest;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: async () => ({ success: false, error: "Not initialized" }),
  register: async () => ({ success: false, error: "Not initialized" }),
  logout: () => {},
  isLoggedIn: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Initialize mock users on first load
    initUsers();
    // Restore current session
    try {
      const stored = localStorage.getItem(CURRENT_USER_KEY);
      if (stored) {
        setUser(JSON.parse(stored) as AuthUser);
      }
    } catch {}
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Hardcoded admin shortcut
    if (email === "admin@goo.com" && password === "admin123") {
      const adminUser: AuthUser = {
        id: "admin-root",
        name: "Admin",
        email: "admin@goo.com",
        plan: "ultra",
        isAdmin: true,
        joinedAt: "2023-01-01",
      };
      setUser(adminUser);
      try {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(adminUser));
      } catch {}
      return { success: true };
    }

    const users = getUsers();
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!found) {
      return { success: false, error: "Invalid email or password." };
    }

    const authUser = stripPassword(found);
    setUser(authUser);
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authUser));
    } catch {}
    return { success: true };
  };

  const register = async (
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const users = getUsers();
    const exists = users.some(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (exists) {
      return { success: false, error: "An account with this email already exists." };
    }

    const isAdmin = email.toLowerCase().includes("admin");
    const newUser: StoredUser = {
      id: `u-${Date.now()}`,
      name,
      email,
      password,
      plan: "free",
      isAdmin,
      joinedAt: new Date().toISOString().split("T")[0],
    };

    const updated = [...users, newUser];
    saveUsers(updated);

    const authUser = stripPassword(newUser);
    setUser(authUser);
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authUser));
    } catch {}
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        isLoggedIn: user !== null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
