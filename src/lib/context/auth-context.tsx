"use client";

import { createContext, useContext } from "react";
import { useUser, useClerk } from "@clerk/nextjs";

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

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: async () => ({ success: false, error: "Use /login page" }),
  register: async () => ({ success: false, error: "Use /register page" }),
  logout: () => {},
  isLoggedIn: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut, openSignIn, openSignUp } = useClerk();

  const user: AuthUser | null =
    isLoaded && clerkUser
      ? {
          id: clerkUser.id,
          name:
            clerkUser.fullName ||
            clerkUser.firstName ||
            clerkUser.emailAddresses[0]?.emailAddress.split("@")[0] ||
            "User",
          email: clerkUser.emailAddresses[0]?.emailAddress || "",
          // Plan stored in publicMetadata; defaults to "free"
          plan: ((clerkUser.publicMetadata as { plan?: string }).plan as AuthUser["plan"]) ?? "free",
          isAdmin: (clerkUser.publicMetadata as { isAdmin?: boolean }).isAdmin === true,
          avatar: clerkUser.imageUrl || undefined,
          joinedAt: clerkUser.createdAt
            ? new Date(clerkUser.createdAt).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        }
      : null;

  // login / register are now handled by Clerk's UI components.
  // These fallbacks open the Clerk modal in case something triggers them programmatically.
  const login = async (): Promise<{ success: boolean; error?: string }> => {
    openSignIn();
    return { success: true };
  };

  const register = async (): Promise<{ success: boolean; error?: string }> => {
    openSignUp();
    return { success: true };
  };

  const logout = () => {
    signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        isLoggedIn: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
